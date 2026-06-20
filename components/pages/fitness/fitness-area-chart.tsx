import { useMemo, useState } from 'react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { FitnessActivity } from '@/pages/fitness';

type Unit = 'km' | 'mi';

function weekKey(iso: string) {
  const d = new Date(iso);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function FitnessAreaChart({
  activities,
  unit,
}: {
  activities: FitnessActivity[];
  unit: Unit;
}) {
  const [days, setDays] = useState(90);

  const data = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const buckets: Record<string, { dist: number; count: number }> = {};
    for (const a of activities) {
      if (new Date(a.start_time) < cutoff) continue;
      const k = weekKey(a.start_time);
      buckets[k] ??= { dist: 0, count: 0 };
      buckets[k].dist += unit === 'km' ? (a.distance_meters ?? 0) / 1000 : (a.distance_meters ?? 0) / 1609.344;
      buckets[k].count += 1;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, distance: parseFloat(v.dist.toFixed(1)), count: v.count }));
  }, [activities, unit, days]);

  const unitLabel = unit === 'km' ? 'km' : 'mi';

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
        <AreaChart data={data} margin={{ top: 4, left: 0, right: 4, bottom: -12 }}>
          <defs>
            <linearGradient id="fitnessGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0090FF" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0090FF" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            width={48}
            tickFormatter={(v) => `${v}${unitLabel}`}
          />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded border border-gray-6 bg-gray-3 p-2 text-sm">
                  <div className="font-medium text-gray-12">
                    {parseFloat(String(payload[0].value)).toFixed(1)}{' '}
                    <span className="text-xs text-gray-11">{unitLabel}</span>
                  </div>
                  <div className="text-xs text-gray-11">
                    {payload[0].payload.count} activities ·{' '}
                    {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="distance"
            stroke="#0090FF"
            strokeWidth={2}
            fill="url(#fitnessGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#0090FF', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
