import { useState } from 'react';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { FitnessActivity } from '@/pages/fitness';
import FitnessActivityModal from './fitness-activity-modal';

type Unit = 'km' | 'mi';

const PAGE_SIZE = 10;

const SPORT_LABELS: Record<string, string> = {
  Run: 'Run', TrailRun: 'Trail Run', VirtualRun: 'Virtual Run',
  running: 'Run', treadmill_running: 'Treadmill', trail_running: 'Trail Run',
  Ride: 'Ride', VirtualRide: 'Virtual Ride', MountainBikeRide: 'MTB',
  GravelRide: 'Gravel', EBikeRide: 'E-Bike', road_biking: 'Road Bike',
  Swim: 'Swim', open_water_swimming: 'Open Water Swim',
  Walk: 'Walk', walking: 'Walk', Hike: 'Hike',
  WeightTraining: 'Strength', Workout: 'Workout', Yoga: 'Yoga',
  AlpineSki: 'Alpine Ski', breathwork: 'Breathwork',
};

const SPORT_COLORS: Record<string, string> = {
  Run: 'text-blue-11 bg-blue-3 border-blue-6',
  TrailRun: 'text-blue-11 bg-blue-3 border-blue-6',
  VirtualRun: 'text-blue-11 bg-blue-3 border-blue-6',
  running: 'text-blue-11 bg-blue-3 border-blue-6',
  treadmill_running: 'text-blue-11 bg-blue-3 border-blue-6',
  trail_running: 'text-blue-11 bg-blue-3 border-blue-6',
  Ride: 'text-green-11 bg-green-3 border-green-6',
  VirtualRide: 'text-green-11 bg-green-3 border-green-6',
  MountainBikeRide: 'text-green-11 bg-green-3 border-green-6',
  GravelRide: 'text-green-11 bg-green-3 border-green-6',
  EBikeRide: 'text-green-11 bg-green-3 border-green-6',
  road_biking: 'text-green-11 bg-green-3 border-green-6',
  Walk: 'text-orange-11 bg-orange-3 border-orange-6',
  walking: 'text-orange-11 bg-orange-3 border-orange-6',
  Hike: 'text-orange-11 bg-orange-3 border-orange-6',
  Swim: 'text-cyan-11 bg-cyan-3 border-cyan-6',
  open_water_swimming: 'text-cyan-11 bg-cyan-3 border-cyan-6',
  WeightTraining: 'text-purple-11 bg-purple-3 border-purple-6',
  Workout: 'text-purple-11 bg-purple-3 border-purple-6',
  AlpineSki: 'text-cyan-11 bg-cyan-3 border-cyan-6',
};

function fmtDistance(m: number | null, unit: Unit) {
  if (!m) return '—';
  return unit === 'km' ? `${(m / 1000).toFixed(1)} km` : `${(m / 1609.344).toFixed(1)} mi`;
}

function fmtDuration(s: number | null) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FitnessActivities({
  activities,
  unit,
}: {
  activities: FitnessActivity[];
  unit: Unit;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<FitnessActivity | null>(null);

  const totalPages = Math.ceil(activities.length / PAGE_SIZE);
  const pageItems = activities.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to page 0 when activities list changes (filter change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleFilterReset = () => setPage(0);

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-11">
        No activities to display.
      </div>
    );
  }

  return (
    <>
      {/* Table */}
      <div className="w-full">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 border-b border-gray-6 px-4 py-2 text-xs font-medium uppercase tracking-widest text-gray-10">
          <span>Activity</span>
          <span className="text-right">Distance</span>
          <span className="text-right">Duration</span>
          <span className="hidden text-right sm:block">Avg HR</span>
          <span className="text-right">Source</span>
        </div>

        {pageItems.map((a) => {
          const sportClass = a.sport_type
            ? (SPORT_COLORS[a.sport_type] ?? 'text-gray-11 bg-gray-3 border-gray-6')
            : 'text-gray-11 bg-gray-3 border-gray-6';

          return (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="grid w-full grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 border-b border-gray-6/50 px-4 py-3 text-sm transition-colors hover:bg-gray-3 cursor-pointer text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-12">{a.name ?? 'Untitled'}</span>
                  {a.sport_type && (
                    <span className={clsx('hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline', sportClass)}>
                      {SPORT_LABELS[a.sport_type] ?? a.sport_type}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-gray-11">{fmtDate(a.start_time)}</div>
              </div>
              <div className="text-right text-gray-12">{fmtDistance(a.distance_meters, unit)}</div>
              <div className="text-right text-gray-11">{fmtDuration(a.duration_seconds)}</div>
              <div className="hidden text-right text-gray-11 sm:block">
                {a.avg_heart_rate ? `${Math.round(a.avg_heart_rate)} bpm` : '—'}
              </div>
              <div className="text-right">
                <span className={clsx(
                  'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                  a.source === 'strava'
                    ? 'border-orange-6 bg-orange-3 text-orange-11'
                    : 'border-blue-6 bg-blue-3 text-blue-11',
                )}>
                  {a.source}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-6 px-4 py-3">
          <span className="text-xs text-gray-11">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, activities.length)} of{' '}
            {activities.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex h-7 w-7 items-center justify-center rounded border border-gray-6 text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, i, idx, arr) => {
                if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                acc.push(i);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1 text-xs text-gray-10">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded border text-xs transition-colors',
                      page === item
                        ? 'border-gray-7 bg-gray-4 font-medium text-gray-12'
                        : 'border-gray-6 text-gray-11 hover:bg-gray-3 hover:text-gray-12',
                    )}
                  >
                    {item + 1}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-gray-6 text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <FitnessActivityModal activity={selected} unit={unit} onClose={() => setSelected(null)} />
    </>
  );
}
