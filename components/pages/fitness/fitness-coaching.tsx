import { Fragment, useCallback, useMemo, type PointerEvent } from 'react';
import { TooltipWithBounds, useTooltip, useTooltipInPortal } from '@visx/tooltip';
import clsx from 'clsx';

import type { FitnessSleepRecord, FitnessRecoveryRecord, FitnessActivity } from '@/pages/fitness';

interface Props {
  sleep: FitnessSleepRecord[];
  recovery: FitnessRecoveryRecord[];
  activities: FitnessActivity[];
}

type Signal = 'good' | 'moderate' | 'poor';

interface Metric {
  label: string;
  value?: string;
  signal: Signal;
  note: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function scoreVal(val: number | null | undefined, good: number, bad: number): Signal {
  if (val == null) return 'moderate';
  const ascending = good > bad;
  if (ascending) return val >= good ? 'good' : val <= bad ? 'poor' : 'moderate';
  return val <= good ? 'good' : val >= bad ? 'poor' : 'moderate';
}

function overallSignal(signals: Signal[]): Signal {
  const poor = signals.filter((s) => s === 'poor').length;
  const good = signals.filter((s) => s === 'good').length;
  if (poor >= 2) return 'poor';
  if (poor === 1 && good === 0) return 'poor';
  if (good >= Math.ceil(signals.length / 2)) return 'good';
  return 'moderate';
}

function avg(arr: (number | null | undefined)[]): number | null {
  const vals = arr.filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function trend(current: number | null, previous: number | null, higherIsBetter: boolean): '↑' | '↓' | '→' {
  if (current == null || previous == null) return '→';
  const diff = current - previous;
  if (Math.abs(diff) < Math.abs(previous) * 0.05) return '→';
  return diff > 0 ? (higherIsBetter ? '↑' : '↓') : (higherIsBetter ? '↓' : '↑');
}

function trendSignal(t: '↑' | '↓' | '→'): Signal {
  return t === '↑' ? 'good' : t === '↓' ? 'poor' : 'moderate';
}

// Returns a short human-readable explanation of the primary factor driving the score.
// `metrics` ordered by descending priority / influence.
function mainDriver(metrics: Metric[], overall: Signal): string | null {
  if (overall === 'poor') {
    const worst = metrics.find((m) => m.signal === 'poor');
    if (worst) return `${worst.label} is the main drag — ${worst.note.toLowerCase()}`;
  }
  if (overall === 'good') {
    const best = metrics.find((m) => m.signal === 'good');
    if (best) return `${best.label} leading recovery — ${best.note.toLowerCase()}`;
  }
  // moderate: surface any standout poor or good
  const poor = metrics.find((m) => m.signal === 'poor');
  if (poor) return `Watch ${poor.label.toLowerCase()} — ${poor.note.toLowerCase()}`;
  const good = metrics.find((m) => m.signal === 'good');
  if (good) return `${good.label} is a bright spot — ${good.note.toLowerCase()}`;
  return null;
}

// Driver for week trends: pick the metric with the strongest directional signal
function weekDriver(
  metrics: { label: string; current: number | null; previous: number | null; higherIsBetter: boolean; unit: string }[],
  overall: Signal,
): string | null {
  const scored = metrics
    .map((m) => {
      const t = trend(m.current, m.previous, m.higherIsBetter);
      const pct = m.previous && m.current != null
        ? Math.abs((m.current - m.previous) / m.previous) * 100
        : 0;
      return { ...m, t, pct };
    })
    .filter((m) => m.t !== '→')
    .sort((a, b) => b.pct - a.pct);

  if (scored.length === 0) return null;

  const top = scored[0];
  const fmt = (v: number | null) => v != null ? `${Math.round(v)}${top.unit}` : '—';
  const direction = top.t === '↑' ? 'up' : 'down';
  const impact = top.higherIsBetter
    ? (top.t === '↑' ? 'helping recovery' : 'weighing on recovery')
    : (top.t === '↓' ? 'helping recovery' : 'weighing on recovery');

  if (overall === 'good') {
    const best = scored.find((m) => trendSignal(m.t) === 'good');
    if (best) return `${best.label} ${direction} from ${fmt(best.previous)} → ${fmt(best.current)} — ${impact}`;
  }
  if (overall === 'poor') {
    const worst = scored.find((m) => trendSignal(m.t) === 'poor');
    if (worst) {
      const wDir = worst.t === '↑' ? 'up' : 'down';
      const wImpact = worst.higherIsBetter
        ? (worst.t === '↑' ? 'helping recovery' : 'weighing on recovery')
        : (worst.t === '↓' ? 'helping recovery' : 'weighing on recovery');
      return `${worst.label} ${wDir} from ${fmt(worst.previous)} → ${fmt(worst.current)} — ${wImpact}`;
    }
  }
  return `${top.label} moved the most — ${direction} from ${fmt(top.previous)} to ${fmt(top.current)}`;
}

// Driver explanation for a single recovery record (used in heatmap tooltip)
function recoveryDriver(r: FitnessRecoveryRecord): string | null {
  const candidates: { label: string; signal: Signal; note: string }[] = [];

  if (r.training_readiness != null) {
    const s = scoreVal(r.training_readiness, 60, 40);
    candidates.push({ label: 'Readiness', signal: s, note: r.training_readiness >= 60 ? 'ready to train' : r.training_readiness >= 40 ? 'train easy' : 'skip hard effort' });
  }
  if (r.body_battery_high != null) {
    const s = scoreVal(r.body_battery_high, 70, 40);
    candidates.push({ label: 'Body battery', signal: s, note: r.body_battery_high >= 70 ? 'well charged' : r.body_battery_high >= 40 ? 'partial charge' : 'depleted' });
  }
  if (r.hrv_status) {
    const s: Signal = r.hrv_status === 'Balanced' ? 'good' : r.hrv_status === 'Unbalanced' ? 'poor' : 'moderate';
    candidates.push({ label: 'HRV', signal: s, note: r.hrv_status.toLowerCase() });
  }
  if (r.resting_hr != null) {
    const s = scoreVal(r.resting_hr, 48, 60);
    candidates.push({ label: 'Resting HR', signal: s, note: r.resting_hr <= 48 ? 'low — recovered' : r.resting_hr <= 60 ? 'normal range' : 'elevated' });
  }
  if (r.stress_avg != null) {
    const s = scoreVal(r.stress_avg, 20, 40);
    candidates.push({ label: 'Stress', signal: s, note: r.stress_avg <= 20 ? 'low stress' : r.stress_avg <= 40 ? 'moderate stress' : 'high stress' });
  }

  const overall = overallSignal(candidates.map((c) => c.signal));
  return mainDriver(candidates, overall);
}

// ── constants ─────────────────────────────────────────────────────────────────

const SIGNAL_DOT: Record<Signal, string> = {
  good: 'bg-green-500',
  moderate: 'bg-yellow-500',
  poor: 'bg-red-500',
};

const SIGNAL_BADGE: Record<Signal, string> = {
  good: 'bg-green-950 border-green-800 text-green-400',
  moderate: 'bg-yellow-950 border-yellow-800 text-yellow-400',
  poor: 'bg-red-950 border-red-800 text-red-400',
};

const SIGNAL_LABEL: Record<Signal, string> = {
  good: 'Good to train',
  moderate: 'Train easy',
  poor: 'Rest / recover',
};

const SQ = 12;
const GAP = 2;

// ── sub-components ────────────────────────────────────────────────────────────

function MetricTile({ label, value, signal, note }: Metric) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-6 bg-gray-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-gray-10">{label}</span>
        <span className={clsx('h-2 w-2 rounded-full', SIGNAL_DOT[signal])} />
      </div>
      <div className="text-xl font-semibold text-gray-12">{value}</div>
      <div className="text-xs text-gray-10">{note}</div>
    </div>
  );
}

function WeekRow({ label, current, previous, unit, higherIsBetter }: {
  label: string;
  current: number | null;
  previous: number | null;
  unit: string;
  higherIsBetter: boolean;
}) {
  const t = trend(current, previous, higherIsBetter);
  const sig = trendSignal(t);
  const fmt = (v: number | null) => v != null ? `${Math.round(v)}${unit}` : '—';
  return (
    <div className="flex items-center justify-between border-b border-gray-6 py-2 last:border-0">
      <span className="text-sm text-gray-11">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-10">{fmt(previous)} →</span>
        <span className="text-sm font-medium text-gray-12">{fmt(current)}</span>
        <span className={clsx('text-sm font-bold', {
          'text-green-400': sig === 'good',
          'text-yellow-400': sig === 'moderate',
          'text-red-400': sig === 'poor',
        })}>{t}</span>
      </div>
    </div>
  );
}

// readiness score per day: 0–100 where readiness is primary, fall back to body battery
function dailyScore(r: FitnessRecoveryRecord): number | null {
  if (r.training_readiness != null) return r.training_readiness;
  if (r.body_battery_high != null) return r.body_battery_high;
  return null;
}

function readinessColor(score: number): string {
  if (score >= 60) return 'fill-green-9';
  if (score >= 40) return 'fill-yellow-9';
  return 'fill-red-9';
}

function ReadinessHeatmap({ recovery }: { recovery: FitnessRecoveryRecord[] }) {
  const year = new Date().getFullYear();

  const { containerRef, containerBounds } = useTooltipInPortal({ scroll: true, detectBounds: true });
  const { showTooltip, hideTooltip, tooltipOpen, tooltipLeft, tooltipTop, tooltipData } =
    useTooltip<string>({ tooltipOpen: false });

  const byDate = useMemo(() => {
    const map: Record<string, FitnessRecoveryRecord> = {};
    for (const r of recovery) map[r.date] = r;
    return map;
  }, [recovery]);

  const firstDay = useMemo(() => new Date(Date.UTC(year, 0, 1)), [year]);
  const dayOffset = useMemo(() => firstDay.getUTCDay(), [firstDay]);

  const grid = useMemo(() => {
    const rows: ({ date: string; score: number | null } | null)[][] = Array(7)
      .fill(null)
      .map(() => new Array(53).fill(null));
    const date = new Date(Date.UTC(year, 0, 1));
    const daysInYear = year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0) ? 366 : 365;
    for (let i = 0; i < daysInYear; i++) {
      const dow = date.getUTCDay();
      const col = Math.floor(i / 7) + (date.getUTCDay() < dayOffset ? 1 : 0);
      const key = date.toISOString().slice(0, 10);
      const rec = byDate[key];
      rows[dow][col] = { date: key, score: rec ? dailyScore(rec) : null };
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return rows;
  }, [year, dayOffset, byDate]);

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const tLeft = ('clientX' in event ? event.clientX : 0) - containerBounds.left;
      const tTop = ('clientY' in event ? event.clientY : 0) - containerBounds.top;
      const target = event.target as SVGPathElement;
      const dataDate = target.getAttribute('data-date');
      if (!dataDate) return;
      const rec = byDate[dataDate];
      if (!rec) return;
      showTooltip({
        tooltipLeft: tLeft,
        tooltipTop: tTop,
        tooltipData: JSON.stringify({
          date: dataDate,
          readiness: rec.training_readiness,
          body_battery: rec.body_battery_high,
          hrv: rec.hrv,
          resting_hr: rec.resting_hr,
          stress: rec.stress_avg,
          driver: recoveryDriver(rec),
        }),
      });
    },
    [containerBounds, byDate, showTooltip],
  );

  const svgWidth = 53 * SQ + 52 * GAP;
  const svgHeight = 7 * SQ + 6 * GAP + 16;

  return (
    <div className="flex flex-col p-4">
      <div className="relative">
        <div className="hide-scrollbar overflow-x-auto">
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            xmlns="http://www.w3.org/2000/svg"
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onMouseLeave={hideTooltip}
          >
            {Array(12).fill(null).map((_, month) => {
              const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
              const col = Math.ceil(
                (86_400 * dayOffset + firstDayOfMonth.getTime() - firstDay.getTime()) / 604_800_000,
              );
              return (
                <text key={month} x={(SQ + GAP) * col} y={12} fontSize={12} className="fill-gray-11">
                  {firstDayOfMonth.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
                </text>
              );
            })}

            {grid.map((row, y) => (
              <Fragment key={y}>
                {row.map((day, x) => {
                  if (day === null) return null;
                  const pathD = `M${(SQ + GAP) * x + 2} ${(SQ + GAP) * y + 0.5 + 16}h${SQ - 4}q1.5 0 1.5 1.5v${SQ - 4}q0 1.5-1.5 1.5h-${SQ - 4}q-1.5 0-1.5-1.5v-${SQ - 4}q0-1.5 1.5-1.5z`;
                  if (day.score == null) {
                    return <path key={`r-${x}-${y}`} d={pathD} className="fill-transparent stroke-gray-7" />;
                  }
                  return (
                    <path
                      key={`r-${x}-${y}`}
                      d={pathD}
                      className={clsx('stroke-gray-7 transition-colors hover:stroke-gray-9', readinessColor(day.score))}
                      fillOpacity={Math.max(0.2, day.score / 100)}
                      data-date={day.date}
                    />
                  );
                })}
              </Fragment>
            ))}
          </svg>
        </div>

        {tooltipOpen && tooltipLeft !== undefined && tooltipTop !== undefined && tooltipData && (
          <TooltipWithBounds
            key={Math.random()}
            top={tooltipTop}
            left={tooltipLeft}
            offsetLeft={-SQ}
            className="pointer-events-none absolute left-0 top-0 z-50 rounded border border-gray-6 bg-gray-3 px-2 py-1 text-sm shadow-md"
            style={{}}
          >
            {(() => {
              const d = JSON.parse(tooltipData);
              return (
                <div className="flex flex-col gap-0.5">
                  <div className="font-medium text-gray-12">
                    {new Date(d.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </div>
                  {d.readiness != null && (
                    <div className="flex items-center gap-1 text-gray-11">
                      <span className="w-24 text-xs">Readiness</span>
                      <span className="font-medium text-gray-12">{d.readiness}</span>
                    </div>
                  )}
                  {d.body_battery != null && (
                    <div className="flex items-center gap-1 text-gray-11">
                      <span className="w-24 text-xs">Body battery</span>
                      <span className="font-medium text-gray-12">{d.body_battery}</span>
                    </div>
                  )}
                  {d.hrv != null && (
                    <div className="flex items-center gap-1 text-gray-11">
                      <span className="w-24 text-xs">HRV</span>
                      <span className="font-medium text-gray-12">{Math.round(d.hrv)} ms</span>
                    </div>
                  )}
                  {d.resting_hr != null && (
                    <div className="flex items-center gap-1 text-gray-11">
                      <span className="w-24 text-xs">Resting HR</span>
                      <span className="font-medium text-gray-12">{Math.round(d.resting_hr)} bpm</span>
                    </div>
                  )}
                  {d.stress != null && (
                    <div className="flex items-center gap-1 text-gray-11">
                      <span className="w-24 text-xs">Avg stress</span>
                      <span className="font-medium text-gray-12">{Math.round(d.stress)}</span>
                    </div>
                  )}
                  {d.driver && (
                    <div className="mt-1 border-t border-gray-6 pt-1 text-xs italic text-gray-10">{d.driver}</div>
                  )}
                </div>
              );
            })()}
          </TooltipWithBounds>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 text-xs text-gray-11">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500/60" />
          <span>Poor (&lt;40)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-yellow-500/60" />
          <span>Moderate (40–60)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-500/60" />
          <span>Good (&gt;60)</span>
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function FitnessCoaching({ sleep, recovery, activities }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const latestRecovery = recovery[0];
  const latestSleep = sleep[0];

  const bodyBattery = latestRecovery?.body_battery_high ?? null;
  const hrv = latestRecovery?.hrv ?? null;
  const restingHR = latestRecovery?.resting_hr ?? null;
  const readiness = latestRecovery?.training_readiness ?? null;
  const sleepScore = latestSleep?.sleep_score ?? null;
  const stressAvg = latestRecovery?.stress_avg ?? null;
  const recoveryTimeH = latestRecovery?.recovery_time_hours ?? null;

  const todayMetrics: Metric[] = [
    {
      label: 'Body Battery',
      value: bodyBattery != null ? `${bodyBattery}` : '—',
      signal: scoreVal(bodyBattery, 70, 40),
      note: bodyBattery != null ? (bodyBattery >= 70 ? 'Well charged' : bodyBattery >= 40 ? 'Partial charge' : 'Depleted') : 'No data',
    },
    {
      label: 'Readiness',
      value: readiness != null ? `${readiness}` : '—',
      signal: scoreVal(readiness, 60, 40),
      note: readiness != null ? (readiness >= 60 ? 'Ready to train' : readiness >= 40 ? 'Train easy' : 'Skip hard effort') : 'No data',
    },
    {
      label: 'Sleep Score',
      value: sleepScore != null ? `${sleepScore}` : '—',
      signal: scoreVal(sleepScore, 80, 60),
      note: sleepScore != null ? (sleepScore >= 80 ? 'Well rested' : sleepScore >= 60 ? 'Adequate' : 'Poor sleep') : 'No data',
    },
    {
      label: 'HRV',
      value: hrv != null ? `${hrv} ms` : '—',
      signal: latestRecovery?.hrv_status === 'Balanced' ? 'good' : latestRecovery?.hrv_status === 'Unbalanced' ? 'poor' : scoreVal(hrv, 50, 30),
      note: latestRecovery?.hrv_status ?? (hrv != null ? `${hrv} ms` : 'No data'),
    },
    {
      label: 'Resting HR',
      value: restingHR != null ? `${restingHR} bpm` : '—',
      signal: scoreVal(restingHR, 48, 60),
      note: restingHR != null ? (restingHR <= 48 ? 'Low — recovered' : restingHR <= 60 ? 'Normal' : 'Elevated') : 'No data',
    },
    {
      label: 'Stress',
      value: stressAvg != null ? `${Math.round(stressAvg)}` : '—',
      signal: scoreVal(stressAvg, 20, 40),
      note: stressAvg != null ? (stressAvg <= 20 ? 'Low stress' : stressAvg <= 40 ? 'Moderate' : 'High stress') : 'No data',
    },
  ];

  const todaySignal = overallSignal(todayMetrics.map((m) => m.signal));
  const todayDriver = mainDriver(todayMetrics, todaySignal);

  const thisWeekRecovery = recovery.filter((r) => r.date >= weekAgo);
  const lastWeekRecovery = recovery.filter((r) => r.date >= twoWeeksAgo && r.date < weekAgo);
  const thisWeekSleep = sleep.filter((s) => s.date >= weekAgo);
  const lastWeekSleep = sleep.filter((s) => s.date >= twoWeeksAgo && s.date < weekAgo);
  const thisWeekActs = activities.filter((a) => a.start_time >= new Date(Date.now() - 7 * 86400000).toISOString());
  const lastWeekActs = activities.filter((a) => {
    const t = a.start_time;
    return t >= new Date(Date.now() - 14 * 86400000).toISOString() && t < new Date(Date.now() - 7 * 86400000).toISOString();
  });

  const weekMetrics = [
    { label: 'Avg body battery', current: avg(thisWeekRecovery.map((r) => r.body_battery_high)), previous: avg(lastWeekRecovery.map((r) => r.body_battery_high)), unit: '', higherIsBetter: true },
    { label: 'Avg sleep score', current: avg(thisWeekSleep.map((s) => s.sleep_score)), previous: avg(lastWeekSleep.map((s) => s.sleep_score)), unit: '', higherIsBetter: true },
    { label: 'Avg HRV', current: avg(thisWeekRecovery.map((r) => r.hrv)), previous: avg(lastWeekRecovery.map((r) => r.hrv)), unit: ' ms', higherIsBetter: true },
    { label: 'Avg stress', current: avg(thisWeekRecovery.map((r) => r.stress_avg)), previous: avg(lastWeekRecovery.map((r) => r.stress_avg)), unit: '', higherIsBetter: false },
    { label: 'Training sessions', current: thisWeekActs.length, previous: lastWeekActs.length, unit: '', higherIsBetter: true },
  ];

  const weekSignal = overallSignal(weekMetrics.map((m) => trendSignal(trend(m.current, m.previous, m.higherIsBetter))));
  const wkDriver = weekDriver(weekMetrics, weekSignal);

  const dataDate = latestRecovery?.date ?? latestSleep?.date;
  const isStale = dataDate ? dataDate < today : false;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Readiness heatmap */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
        <div className="border-b border-gray-7 px-4 py-3">
          <div className="font-medium text-gray-12">Readiness Heatmap</div>
          <div className="text-sm text-gray-11">Daily training readiness · {new Date().getFullYear()}</div>
        </div>
        <ReadinessHeatmap recovery={recovery} />
      </div>

      {/* Today */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
        <div className="flex items-start justify-between border-b border-gray-7 px-4 py-3">
          <div>
            <div className="font-medium text-gray-12">Today</div>
            {isStale && <div className="text-xs text-yellow-500">Last synced: {dataDate}</div>}
            {todayDriver && <div className="mt-0.5 text-xs italic text-gray-10">{todayDriver}</div>}
          </div>
          <div className={clsx('rounded-full border px-3 py-1 text-sm font-semibold', SIGNAL_BADGE[todaySignal])}>
            {SIGNAL_LABEL[todaySignal]}
          </div>
        </div>

        {recoveryTimeH != null && recoveryTimeH > 0 && (
          <div className="flex items-center gap-2 border-b border-gray-7 bg-orange-950/40 px-4 py-2 text-sm text-orange-400">
            <span>⏱</span>
            <span>Garmin suggests <strong>{recoveryTimeH}h</strong> more recovery before next hard effort</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          {todayMetrics.map((m) => <MetricTile key={m.label} {...m} />)}
        </div>
      </div>

      {/* This week */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
        <div className="flex items-start justify-between border-b border-gray-7 px-4 py-3">
          <div>
            <div className="font-medium text-gray-12">This Week vs Last Week</div>
            {wkDriver && <div className="mt-0.5 text-xs italic text-gray-10">{wkDriver}</div>}
          </div>
          <div className={clsx('shrink-0 rounded-full border px-3 py-1 text-sm font-semibold', SIGNAL_BADGE[weekSignal])}>
            {weekSignal === 'good' ? 'Trending well' : weekSignal === 'moderate' ? 'Mixed week' : 'Declining'}
          </div>
        </div>
        <div className="flex flex-col px-4 py-2">
          {weekMetrics.map((m) => <WeekRow key={m.label} {...m} />)}
        </div>
      </div>
    </div>
  );
}
