import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import type { AthleteOsPayload, RollingWindow } from '@/lib/athlete-os/types';
import { WINDOW_OPTIONS } from '@/lib/athlete-os/types';
import { discoverRelationships, buildGraph } from '@/lib/athlete-os/services/correlation/relationshipDiscovery';
import { generateInsights } from '@/lib/athlete-os/services/correlation/insightGeneration';

import type { ZoneSession } from '@/lib/athlete-os/services/zones/zoneAnalysis';
import { type RideSummary, estimateFtp } from '@/lib/athlete-os/services/aerobic/aerobicAnalysis';
import type { RunSummary } from '@/lib/athlete-os/services/aerobic/runningAnalysis';
import type { MarathonPayload } from '@/pages/api/athlete-os/marathon';
import { buildGoalModel } from '@/lib/athlete-os/services/marathon/marathonGoal';
import { buildRoadmap } from '@/lib/athlete-os/services/marathon/roadmap';

import MarathonGoal from './marathon-goal';
import AthleteOrb from './athlete-orb';
import InsightFeed from './insight-feed';
import CorrelationExplorer from './correlation-explorer';
import RelationshipGraph from './relationship-graph';
import ZoneDiscipline from './zone-discipline';
import AerobicEngine from './aerobic-engine';
import WeightLog from './weight-log';

const EMPTY_MARATHON: MarathonPayload = { prs: [], predictionTrend: [], weeklyMileage: [], longestRunKm: 0, recentWeeklyAvgKm: 0, latestPredictionFrom: null, currentPredictedSec: null, currentPredictionFrom: null };

/**
 * Athlete OS dashboard — orchestrates data fetch, runs the correlation engine
 * client-side (pure functions), and composes the four surfaces. Deliberately
 * self-contained and independent of the /fitness dashboard.
 */

function Panel({
  title, subtitle, children, right,
}: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-6 bg-gray-1">
      <header className="flex items-center justify-between border-b border-gray-6 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-12">{title}</h2>
          {subtitle && <p className="text-xs text-gray-10">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-64 animate-pulse rounded-2xl border border-gray-6 bg-gray-2" />
      ))}
    </div>
  );
}

// Fetch JSON with retries. The Athlete OS data routes return 503 on a transient
// DB error (rather than a misleading 200-empty), so retrying here lets a blip on
// any one of the parallel mount requests self-heal instead of blanking a panel.
async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr;
}

export default function AthleteOsDashboard() {
  const [data, setData] = useState<AthleteOsPayload | null>(null);
  const [zones, setZones] = useState<{ sessions: ZoneSession[]; observedMaxHr: number | null }>({ sessions: [], observedMaxHr: null });
  const [rides, setRides] = useState<RideSummary[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [marathon, setMarathon] = useState<MarathonPayload>(EMPTY_MARATHON);
  const [loading, setLoading] = useState(true);
  const [graphWindow, setGraphWindow] = useState<RollingWindow>(90);

  useEffect(() => {
    Promise.all([
      fetchJson<AthleteOsPayload>('/api/athlete-os/metrics'),
      fetchJson<{ sessions: ZoneSession[]; observedMaxHr: number | null }>('/api/athlete-os/zones'),
      fetchJson<{ rides: RideSummary[] }>('/api/athlete-os/cycling'),
      fetchJson<{ runs: RunSummary[] }>('/api/athlete-os/running'),
      fetchJson<MarathonPayload>('/api/athlete-os/marathon'),
    ])
      .then(([d, z, c, rn, mar]) => {
        setData(d); setZones(z); setRides(c.rides ?? []); setRuns(rn.runs ?? []);
        setMarathon(mar); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const ftp = useMemo(() => estimateFtp(rides).ftp, [rides]);

  // Running-specific aerobic (easy Zone 1–2) share, for the marathon base lever.
  const runningAerobicPct = useMemo(() => {
    const runSessions = zones.sessions.filter((s) => s.sport === 'run');
    let easy = 0, total = 0;
    for (const s of runSessions) {
      const t = s.zoneSecs.reduce((a, b) => a + b, 0);
      easy += (s.zoneSecs[0] ?? 0) + (s.zoneSecs[1] ?? 0);
      total += t;
    }
    return total > 0 ? (easy / total) * 100 : null;
  }, [zones.sessions]);

  const goalModel = useMemo(() => buildGoalModel(marathon, runningAerobicPct), [marathon, runningAerobicPct]);
  const roadmap = useMemo(() => buildRoadmap({
    predictedSec: goalModel.predictedSeconds,
    volumeKm: marathon.recentWeeklyAvgKm,
    longestKm: marathon.longestRunKm,
    aerobicPct: runningAerobicPct,
  }), [goalModel.predictedSeconds, marathon.recentWeeklyAvgKm, marathon.longestRunKm, runningAerobicPct]);

  const correlations = useMemo(
    () => (data ? discoverRelationships(data.matrix, { window: graphWindow, minStrength: 0.25, minConfidence: 'low' }) : []),
    [data, graphWindow],
  );
  const graph = useMemo(() => buildGraph(correlations), [correlations]);
  const insights = useMemo(
    () => (data ? generateInsights(data.matrix, correlations, data.today) : []),
    [data, correlations],
  );

  if (loading) return <Skeleton />;

  const hasData = data && data.matrix.dates.length > 0;
  if (!hasData) {
    return (
      <div className="rounded-2xl border border-gray-6 bg-gray-1 p-10 text-center">
        <p className="text-sm text-gray-11">No data available yet.</p>
        <p className="mt-1 text-xs text-gray-10">Athlete OS reads from your synced Garmin, WHOOP, and Strava data.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Marathon goal — the north star (tracker + periodized checkpoints) */}
      <Panel title="Marathon Goal" subtitle="Your live tracker toward sub-4 on Jan 31, 2027">
        <MarathonGoal model={goalModel} roadmap={roadmap} />
      </Panel>

      {/* Orb — today */}
      <Panel title="Today" subtitle={data!.today ? `Athlete Score · ${data!.today.date}` : 'No score for today'}>
        <AthleteOrb today={data!.today} />
      </Panel>

      {/* Insights */}
      <Panel title="Insights" subtitle="Generated from your correlation patterns">
        <InsightFeed insights={insights} />
      </Panel>

      {/* Zone discipline */}
      <Panel title="Zone Discipline" subtitle="Are your easy days actually easy? Polarized-training balance vs the 80/20 ideal">
        <ZoneDiscipline sessions={zones.sessions} observedMaxHr={zones.observedMaxHr} />
      </Panel>

      {/* Aerobic Zone 2 — cycling + running */}
      <Panel title="Aerobic Engine · Zone 2" subtitle="Your true Zone 2 derived from HR–intensity history, not formulas — cycling and running">
        <AerobicEngine rides={rides} runs={runs} />
      </Panel>

      {/* Weight / body composition */}
      <Panel title="Body Composition" subtitle="Manual weight log · goal 165–170 lb · power-to-weight">
        <WeightLog ftp={ftp} />
      </Panel>

      {/* Correlation Explorer */}
      <Panel title="Correlation Explorer" subtitle="Test any two metrics — with lag and rolling-window controls">
        <CorrelationExplorer matrix={data!.matrix} />
      </Panel>

      {/* Relationship graph */}
      <Panel
        title="Relationship Graph"
        subtitle="Discovered connections between recovery, sleep, load, and performance"
        right={
          <div className="flex overflow-hidden rounded-md border border-gray-6">
            {WINDOW_OPTIONS.map((w) => (
              <button
                key={w}
                onClick={() => setGraphWindow(w)}
                className={clsx(
                  'px-2.5 py-1 text-xs font-medium transition-colors',
                  graphWindow === w ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3',
                )}
              >
                {w === 0 ? 'All' : `${w}d`}
              </button>
            ))}
          </div>
        }
      >
        <RelationshipGraph graph={graph} />
      </Panel>
    </div>
  );
}
