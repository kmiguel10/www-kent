'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { FitnessActivity } from '@/pages/fitness';

type Unit = 'km' | 'mi';

const RUN_SPORTS = new Set(['Run', 'VirtualRun', 'TrailRun', 'running', 'treadmill_running', 'trail_running', 'track_running']);
const CYCLE_SPORTS = new Set(['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'road_biking', 'virtual_ride']);

interface Effort {
  label: string;
  sublabel: string;
  value: string;
  unitLabel?: string;
  date: string | null;
  activityName: string | null;
  isEstimate?: boolean;
}

function formatTime(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.round(totalSecs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSpeed(ms: number, unit: Unit): string {
  return unit === 'km'
    ? `${(ms * 3.6).toFixed(1)} km/h`
    : `${(ms * 2.23694).toFixed(1)} mph`;
}

function formatDist(m: number, unit: Unit): string {
  return unit === 'km'
    ? `${(m / 1000).toFixed(1)} km`
    : `${(m / 1609.344).toFixed(1)} mi`;
}

function computeBestEfforts(
  activities: FitnessActivity[],
  unit: Unit,
): { running: Effort[]; cycling: Effort[] } {
  const runs = activities.filter((a) => RUN_SPORTS.has(a.sport_type ?? ''));
  const rides = activities.filter((a) => CYCLE_SPORTS.has(a.sport_type ?? ''));

  // ── RUNNING ──────────────────────────────────────────────────────────────

  // Best 1K split from Garmin fastestSplit_1000 field
  let best1KSecs = Infinity;
  let best1KActivity: FitnessActivity | null = null;
  for (const a of runs) {
    if (a.source !== 'garmin' || !a.raw_data) continue;
    const v = a.raw_data.fastestSplit_1000 as number | undefined;
    if (v && v < best1KSecs) { best1KSecs = v; best1KActivity = a; }
  }

  // Best 5K: pick lower of (a) Garmin fastestSplit_5000 or (b) runs in 4.5–5.5km range
  let best5KSplit = Infinity;
  let best5KSplitActivity: FitnessActivity | null = null;
  let best5KRaceSecs = Infinity;
  let best5KRaceActivity: FitnessActivity | null = null;
  for (const a of runs) {
    if (a.source === 'garmin' && a.raw_data) {
      const v = a.raw_data.fastestSplit_5000 as number | undefined;
      if (v && v < best5KSplit) { best5KSplit = v; best5KSplitActivity = a; }
    }
    if (a.distance_meters && a.duration_seconds) {
      const d = a.distance_meters;
      if (d >= 4500 && d <= 5500) {
        const est = a.duration_seconds * (5000 / d);
        if (est < best5KRaceSecs) { best5KRaceSecs = est; best5KRaceActivity = a; }
      }
    }
  }
  const use5KSplit = best5KSplit <= best5KRaceSecs;
  const best5KSecs = use5KSplit ? best5KSplit : best5KRaceSecs;
  const best5KActivity = use5KSplit ? best5KSplitActivity : best5KRaceActivity;

  // Best 10K: runs in 9.5–10.6km range
  let best10KSecs = Infinity;
  let best10KActivity: FitnessActivity | null = null;
  for (const a of runs) {
    if (!a.distance_meters || !a.duration_seconds) continue;
    const d = a.distance_meters;
    if (d >= 9500 && d <= 10600) {
      const est = a.duration_seconds * (10000 / d);
      if (est < best10KSecs) { best10KSecs = est; best10KActivity = a; }
    }
  }

  // Best Half Marathon: runs in 20–22.5km range
  let bestHMSecs = Infinity;
  let bestHMActivity: FitnessActivity | null = null;
  for (const a of runs) {
    if (!a.distance_meters || !a.duration_seconds) continue;
    const d = a.distance_meters;
    if (d >= 20000 && d <= 22500) {
      const est = a.duration_seconds * (21097 / d);
      if (est < bestHMSecs) { bestHMSecs = est; bestHMActivity = a; }
    }
  }

  const running: Effort[] = [];

  if (best1KActivity) {
    running.push({
      label: '1K',
      sublabel: 'Fastest split',
      value: formatTime(best1KSecs),
      date: formatDate(best1KActivity.start_time),
      activityName: best1KActivity.name,
    });
  }
  if (best5KActivity) {
    running.push({
      label: '5K',
      sublabel: 'Best time',
      value: formatTime(best5KSecs),
      date: formatDate(best5KActivity.start_time),
      activityName: best5KActivity.name,
    });
  }
  if (best10KActivity) {
    running.push({
      label: '10K',
      sublabel: 'Best time',
      value: formatTime(best10KSecs),
      date: formatDate(best10KActivity.start_time),
      activityName: best10KActivity.name,
    });
  }
  if (bestHMActivity) {
    running.push({
      label: 'Half Marathon',
      sublabel: 'Best time',
      value: formatTime(bestHMSecs),
      date: formatDate(bestHMActivity.start_time),
      activityName: bestHMActivity.name,
    });
  }

  // ── CYCLING ──────────────────────────────────────────────────────────────

  // Longest ride
  let longestDist = 0;
  let longestActivity: FitnessActivity | null = null;
  for (const a of rides) {
    if ((a.distance_meters ?? 0) > longestDist) {
      longestDist = a.distance_meters!;
      longestActivity = a;
    }
  }

  // Fastest avg speed on rides > 20km (using distance/duration)
  let topSpeedMs = 0;
  let topSpeedActivity: FitnessActivity | null = null;
  for (const a of rides) {
    if (!a.distance_meters || !a.duration_seconds || a.distance_meters < 20000) continue;
    const spd = a.distance_meters / a.duration_seconds;
    if (spd > topSpeedMs) { topSpeedMs = spd; topSpeedActivity = a; }
  }

  // Best peak power across Garmin (maxPower) and Strava (max_watts)
  let bestPeakPower = 0;
  let bestPeakActivity: FitnessActivity | null = null;
  for (const a of rides) {
    if (!a.raw_data) continue;
    const p = (a.source === 'garmin'
      ? (a.raw_data.maxPower as number | undefined)
      : (a.raw_data.max_watts as number | undefined)) ?? 0;
    if (p > bestPeakPower) { bestPeakPower = p; bestPeakActivity = a; }
  }

  // Best 20-min power (Garmin maxAvgPower_1200)
  let best20MinPower = 0;
  let best20MinActivity: FitnessActivity | null = null;
  for (const a of rides) {
    if (a.source !== 'garmin' || !a.raw_data) continue;
    const p = (a.raw_data.maxAvgPower_1200 as number | undefined) ?? 0;
    if (p > best20MinPower) { best20MinPower = p; best20MinActivity = a; }
  }

  // Most elevation gain
  let mostElevation = 0;
  let mostElevationActivity: FitnessActivity | null = null;
  for (const a of rides) {
    if ((a.elevation_gain_meters ?? 0) > mostElevation) {
      mostElevation = a.elevation_gain_meters!;
      mostElevationActivity = a;
    }
  }

  const cycling: Effort[] = [];

  if (longestActivity) {
    cycling.push({
      label: 'Longest Ride',
      sublabel: 'Distance',
      value: formatDist(longestDist, unit),
      date: formatDate(longestActivity.start_time),
      activityName: longestActivity.name,
    });
  }
  if (topSpeedActivity) {
    cycling.push({
      label: 'Top Speed',
      sublabel: 'Avg speed on rides > 20km',
      value: formatSpeed(topSpeedMs, unit),
      date: formatDate(topSpeedActivity.start_time),
      activityName: topSpeedActivity.name,
    });
  }
  if (bestPeakActivity) {
    cycling.push({
      label: 'Peak Power',
      sublabel: 'Max instantaneous watts',
      value: `${bestPeakPower}W`,
      date: formatDate(bestPeakActivity.start_time),
      activityName: bestPeakActivity.name,
    });
  }
  if (best20MinActivity) {
    cycling.push({
      label: '20-min Power',
      sublabel: 'Best avg power over 20 min',
      value: `${best20MinPower}W`,
      date: formatDate(best20MinActivity.start_time),
      activityName: best20MinActivity.name,
    });
  }
  if (mostElevationActivity) {
    cycling.push({
      label: 'Most Elevation',
      sublabel: 'Single ride',
      value: `${Math.round(mostElevation)}m`,
      date: formatDate(mostElevationActivity.start_time),
      activityName: mostElevationActivity.name,
    });
  }

  return { running, cycling };
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function EffortCard({ effort }: { effort: Effort }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-6 bg-gray-2 p-4 transition-colors hover:border-gray-7 hover:bg-gray-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-10">{effort.sublabel}</div>
          <div className="mt-0.5 text-sm font-medium text-gray-11">{effort.label}</div>
        </div>
        <TrophyIcon className="h-4 w-4 shrink-0 text-yellow-500" />
      </div>
      <div className="text-3xl font-bold tracking-tight text-gray-12">
        {effort.value}
        {effort.unitLabel && (
          <span className="ml-1 text-base font-normal text-gray-10">{effort.unitLabel}</span>
        )}
      </div>
      <div className="mt-auto space-y-0.5">
        {effort.activityName && (
          <div className="truncate text-xs text-gray-11" title={effort.activityName}>
            {effort.activityName}
          </div>
        )}
        {effort.date && (
          <div className="text-xs text-gray-9">{effort.date}</div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-gray-6 text-center">
      <TrophyIcon className="h-8 w-8 text-gray-7" />
      <p className="mt-3 text-sm text-gray-10">No {label} data yet</p>
      <p className="mt-1 text-xs text-gray-9">Start logging {label.toLowerCase()} activities</p>
    </div>
  );
}

export default function FitnessBestEfforts({
  activities,
  unit,
}: {
  activities: FitnessActivity[];
  unit: Unit;
}) {
  const [tab, setTab] = useState<'running' | 'cycling'>('running');

  const { running, cycling } = useMemo(
    () => computeBestEfforts(activities, unit),
    [activities, unit],
  );

  const efforts = tab === 'running' ? running : cycling;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
      {/* Header */}
      <div className="flex h-[4.5rem] items-center justify-between border-b border-gray-7 px-4">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-6 bg-gray-3 text-gray-11">
            <TrophyIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium text-gray-12">Best Efforts</div>
            <div className="text-sm text-gray-11">Personal records across all activities</div>
          </div>
        </div>
        {/* Tab switcher */}
        <div className="flex overflow-hidden rounded-lg border border-gray-6">
          {(['running', 'cycling'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-gray-4 text-gray-12' : 'text-gray-10 hover:bg-gray-3 hover:text-gray-11',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="p-4">
        {efforts.length === 0 ? (
          <EmptyState label={tab === 'running' ? 'Running' : 'Cycling'} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {efforts.map((e) => (
              <EffortCard key={e.label} effort={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
