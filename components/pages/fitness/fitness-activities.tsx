import clsx from 'clsx';

import type { FitnessActivity } from '@/pages/fitness';

type Unit = 'km' | 'mi';

const SPORT_LABELS: Record<string, string> = {
  Run: 'Run', TrailRun: 'Trail Run', VirtualRun: 'Virtual Run',
  Ride: 'Ride', VirtualRide: 'Virtual Ride', MountainBikeRide: 'MTB', GravelRide: 'Gravel', EBikeRide: 'E-Bike',
  Walk: 'Walk', Hike: 'Hike', Swim: 'Swim',
  WeightTraining: 'Strength', Workout: 'Workout', Yoga: 'Yoga',
};

const SPORT_COLORS: Record<string, string> = {
  Run: 'text-blue-11 bg-blue-3 border-blue-6',
  TrailRun: 'text-blue-11 bg-blue-3 border-blue-6',
  VirtualRun: 'text-blue-11 bg-blue-3 border-blue-6',
  Ride: 'text-green-11 bg-green-3 border-green-6',
  VirtualRide: 'text-green-11 bg-green-3 border-green-6',
  MountainBikeRide: 'text-green-11 bg-green-3 border-green-6',
  GravelRide: 'text-green-11 bg-green-3 border-green-6',
  EBikeRide: 'text-green-11 bg-green-3 border-green-6',
  Walk: 'text-orange-11 bg-orange-3 border-orange-6',
  Hike: 'text-orange-11 bg-orange-3 border-orange-6',
  Swim: 'text-cyan-11 bg-cyan-3 border-cyan-6',
  WeightTraining: 'text-purple-11 bg-purple-3 border-purple-6',
  Workout: 'text-purple-11 bg-purple-3 border-purple-6',
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

export default function FitnessActivities({ activities, unit }: { activities: FitnessActivity[]; unit: Unit }) {
  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-11">
        No activities to display.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 border-b border-gray-6 px-4 py-2 text-xs font-medium uppercase tracking-widest text-gray-10">
        <span>Activity</span>
        <span className="text-right">Distance</span>
        <span className="text-right">Duration</span>
        <span className="hidden text-right sm:block">Avg HR</span>
        <span className="text-right">Source</span>
      </div>

      {activities.map((a) => {
        const sportClass = a.sport_type
          ? (SPORT_COLORS[a.sport_type] ?? 'text-gray-11 bg-gray-3 border-gray-6')
          : 'text-gray-11 bg-gray-3 border-gray-6';

        return (
          <div
            key={a.id}
            className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 border-b border-gray-6/50 px-4 py-3 text-sm transition-colors hover:bg-gray-3"
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
              <span
                className={clsx(
                  'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                  a.source === 'strava'
                    ? 'border-orange-6 bg-orange-3 text-orange-11'
                    : 'border-blue-6 bg-blue-3 text-blue-11',
                )}
              >
                {a.source}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
