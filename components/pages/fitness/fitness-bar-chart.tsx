import { useMemo, useState } from 'react';

import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { FitnessActivity } from '@/pages/fitness';

const SPORT_COLORS: Record<string, string> = {
  Run: '#0090FF', TrailRun: '#0090FF', VirtualRun: '#0090FF',
  Ride: '#30A46C', VirtualRide: '#30A46C', MountainBikeRide: '#30A46C', GravelRide: '#30A46C', EBikeRide: '#30A46C',
  Walk: '#F76B15', Hike: '#F76B15',
  Swim: '#00BAD3',
  WeightTraining: '#8E4EC6', Workout: '#8E4EC6', Yoga: '#E54D2E',
};
const DEFAULT_COLOR = '#8D8D98';

const SPORT_LABELS: Record<string, string> = {
  Run: 'Run', TrailRun: 'Trail', VirtualRun: 'Virtual Run',
  Ride: 'Ride', VirtualRide: 'Virtual Ride', MountainBikeRide: 'MTB', GravelRide: 'Gravel', EBikeRide: 'E-Bike',
  Walk: 'Walk', Hike: 'Hike', Swim: 'Swim',
  WeightTraining: 'Strength', Workout: 'Workout', Yoga: 'Yoga',
};

function weekKey(iso: string) {
  const d = new Date(iso);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function FitnessBarChart({ activities }: { activities: FitnessActivity[] }) {
  const [days, setDays] = useState(90);

  const chartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const buckets: Record<string, Record<string, number>> = {};
    for (const a of activities) {
      if (new Date(a.start_time) < cutoff) continue;
      const k = weekKey(a.start_time);
      const sport = a.sport_type ?? 'Other';
      buckets[k] ??= {};
      buckets[k][sport] = (buckets[k][sport] ?? 0) + 1;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sports]) => {
        const entries = Object.entries(sports);
        const topSport = entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other';
        return {
          date,
          total: entries.reduce((s, [, v]) => s + v, 0),
          topSport,
          color: SPORT_COLORS[topSport] ?? DEFAULT_COLOR,
          breakdown: entries,
        };
      });
  }, [activities, days]);

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex gap-1">
        {([7, 30, 90] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              days === d ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3'
            }`}
          >
            {d === 7 ? '7d' : d === 30 ? '30d' : '90d'}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, left: 0, right: 4, bottom: -12 }} barCategoryGap={4}>
          <CartesianGrid />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, strokeWidth: 0 }}
            tickMargin={6}
            minTickGap={32}
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          />
          <YAxis
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, strokeWidth: 0 }}
            tickCount={4}
            width={24}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="min-w-[140px] rounded border border-gray-6 bg-gray-3 p-2 text-sm">
                  <div className="mb-1.5 text-xs text-gray-11">
                    {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  {payload[0]?.payload?.breakdown?.map(([sport, count]: [string, number]) => (
                    <div key={sport} className="flex items-center gap-2 py-0.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: SPORT_COLORS[sport] ?? DEFAULT_COLOR }} />
                      <span className="text-gray-11">{SPORT_LABELS[sport] ?? sport}</span>
                      <span className="ml-auto font-medium text-gray-12">{count}</span>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          <Bar
            dataKey="total"
            radius={[3, 3, 0, 0]}
            shape={(props: any) => {
              const { x, y, width, height, index } = props;
              const item = chartData[index];
              return (
                <path
                  d={`M${x + 2} ${y + height}V${y + 2}q0-2 2-2h${width - 4}q2 0 2 2V${y + height}z`}
                  fill={item?.color ?? DEFAULT_COLOR}
                  fillOpacity={0.9}
                />
              );
            }}
          >
            {chartData.map((_, i) => <Cell key={i} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
