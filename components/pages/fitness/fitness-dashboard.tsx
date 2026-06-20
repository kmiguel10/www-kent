import { useEffect, useMemo, useState } from 'react';

import { Dumbbell } from 'lucide-react';
import clsx from 'clsx';

import type { FitnessActivity, FitnessSleepRecord, FitnessRecoveryRecord } from '@/pages/fitness';
import FitnessHeatmap from './fitness-heatmap';
import FitnessAreaChart from './fitness-area-chart';
import FitnessBarChart from './fitness-bar-chart';
import FitnessActivities from './fitness-activities';
import FitnessInsights from './fitness-insights';
import FitnessBestEfforts from './fitness-best-efforts';
import FitnessSleep from './fitness-sleep';

type Unit = 'km' | 'mi';
type Source = 'all' | 'strava' | 'garmin';

const SPORT_LABELS: Record<string, string> = {
  Run: 'Run', VirtualRun: 'Virtual Run', TrailRun: 'Trail Run',
  Ride: 'Ride', VirtualRide: 'Virtual Ride', MountainBikeRide: 'MTB', GravelRide: 'Gravel', EBikeRide: 'E-Bike',
  Swim: 'Swim', Walk: 'Walk', Hike: 'Hike',
  WeightTraining: 'Strength', Workout: 'Workout', Yoga: 'Yoga',
};

function fmtDistance(meters: number, unit: Unit) {
  if (meters === 0) return '0';
  return unit === 'km' ? `${(meters / 1000).toFixed(0)} km` : `${(meters / 1609.344).toFixed(0)} mi`;
}

function fmtDuration(s: number) {
  if (s === 0) return '0h';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function PillButton({
  active, onClick, children, activeClass, size = 'md',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; activeClass?: string; size?: 'sm' | 'md';
}) {
  const base = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm';
  const on = activeClass ?? 'bg-gray-4 border-gray-7 text-gray-12';
  const off = 'border-gray-6 text-gray-11 hover:bg-gray-3 hover:border-gray-7';
  return (
    <button onClick={onClick} className={clsx(base, 'rounded-full border font-medium transition-colors', active ? on : off)}>
      {children}
    </button>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-gray-4', className)} />;
}

function StatCardSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-6 bg-gray-2 p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-8 w-24" />
    </div>
  );
}

function SectionCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('flex w-full flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2', className)}>
      <div className="flex h-[4.5rem] items-center space-x-2.5 border-b border-gray-7 px-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-6 bg-gray-2 p-4">
      <div className="text-xs font-medium uppercase tracking-widest text-gray-11">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-12">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-10">{sub}</div>}
    </div>
  );
}

function SectionCard({
  title, description, symbol, children, className,
}: {
  title: string; description: string; symbol: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={clsx('flex w-full flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2', className)}>
      <div className="flex h-[4.5rem] items-center space-x-2.5 border-b border-gray-7 px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-6 bg-gray-3 text-gray-11">
          <div className="flex h-6 w-6 items-center justify-center">{symbol}</div>
        </div>
        <div>
          <div className="font-medium text-gray-12">{title}</div>
          <div className="text-sm text-gray-11">{description}</div>
        </div>
      </div>
      <div className="w-full grow">{children}</div>
    </div>
  );
}

export default function FitnessDashboard() {
  const [activities, setActivities] = useState<FitnessActivity[]>([]);
  const [sleepRecords, setSleepRecords] = useState<FitnessSleepRecord[]>([]);
  const [recoveryRecords, setRecoveryRecords] = useState<FitnessRecoveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<Unit>('km');
  const [source, setSource] = useState<Source>('all');
  const [sportType, setSportType] = useState('all');

  useEffect(() => {
    Promise.all([
      fetch('/api/fitness/activities').then((r) => r.json()),
      fetch('/api/fitness/sleep').then((r) => r.json()),
    ])
      .then(([activityData, sleepData]) => {
        setActivities(activityData as FitnessActivity[]);
        setSleepRecords(sleepData.sleep ?? []);
        setRecoveryRecords(sleepData.recovery ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sportTypes = useMemo(() => {
    const types = new Set(activities.map((a) => a.sport_type).filter(Boolean) as string[]);
    return Array.from(types).sort();
  }, [activities]);

  const filtered = useMemo(
    () =>
      activities.filter((a) => {
        if (source !== 'all' && a.source !== source) return false;
        if (sportType !== 'all' && a.sport_type !== sportType) return false;
        return true;
      }),
    [activities, source, sportType],
  );

  const stats = useMemo(
    () =>
      filtered.reduce(
        (acc, a) => ({
          count: acc.count + 1,
          distance: acc.distance + (a.distance_meters ?? 0),
          duration: acc.duration + (a.duration_seconds ?? 0),
          calories: acc.calories + (a.calories ?? 0),
        }),
        { count: 0, distance: 0, duration: 0, calories: 0 },
      ),
    [filtered],
  );

  if (loading) {
    return (
      <div className="flex flex-col space-y-4">
        {/* Controls skeleton */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <div className="h-4 w-px bg-gray-6" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>

        {/* Heatmap skeleton */}
        <SectionCardSkeleton />

        {/* Charts row skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SectionCardSkeleton className="h-72" />
          <SectionCardSkeleton className="h-72" />
        </div>

        {/* Activities skeleton */}
        <SectionCardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <PillButton active={source === 'all'} onClick={() => setSource('all')}>All</PillButton>
          <PillButton active={source === 'strava'} onClick={() => setSource('strava')} activeClass="bg-orange-900 border-orange-700 text-orange-300">
            Strava
          </PillButton>
          <PillButton active={source === 'garmin'} onClick={() => setSource('garmin')} activeClass="bg-blue-900 border-blue-700 text-blue-300">
            Garmin
          </PillButton>
        </div>
        <div className="h-4 w-px bg-gray-6" />
        <div className="flex overflow-hidden rounded-md border border-gray-6">
          {(['km', 'mi'] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={clsx('px-3 py-1 text-sm transition-colors', unit === u ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3')}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Sport type pills */}
      {sportTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <PillButton size="sm" active={sportType === 'all'} onClick={() => setSportType('all')}>All types</PillButton>
          {sportTypes.map((t) => (
            <PillButton key={t} size="sm" active={sportType === t} onClick={() => setSportType(sportType === t ? 'all' : t)}>
              {SPORT_LABELS[t] ?? t}
            </PillButton>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Activities" value={stats.count.toLocaleString()} />
        <StatCard label="Distance" value={fmtDistance(stats.distance, unit)} />
        <StatCard label="Active Time" value={fmtDuration(stats.duration)} />
        <StatCard
          label="Calories"
          value={stats.calories >= 1000 ? `${(stats.calories / 1000).toFixed(1)}k` : stats.calories.toLocaleString()}
          sub="kcal"
        />
      </div>

      {/* Insights */}
      <FitnessInsights activities={filtered} unit={unit} />

      {/* Best Efforts */}
      <FitnessBestEfforts activities={filtered} unit={unit} />

      {/* Sleep & Recovery */}
      <FitnessSleep sleep={sleepRecords} recovery={recoveryRecords} />

      {/* Heatmap */}
      <SectionCard title="Activity Heatmap" description="Daily workout frequency" symbol={<Dumbbell size={16} />}>
        <FitnessHeatmap activities={filtered} />
      </SectionCard>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionCard
          title="Weekly Distance"
          description={`Distance per week · ${unit}`}
          symbol={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
          className="h-72"
        >
          <FitnessAreaChart activities={filtered} unit={unit} />
        </SectionCard>

        <SectionCard
          title="Sport Breakdown"
          description="Weekly activities by type"
          symbol={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>}
          className="h-72"
        >
          <FitnessBarChart activities={filtered} />
        </SectionCard>
      </div>

      {/* Recent activities */}
      <SectionCard
        title="Recent Activities"
        description={`${filtered.length} total`}
        symbol={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>}
      >
        <FitnessActivities activities={filtered} unit={unit} />
      </SectionCard>
    </div>
  );
}
