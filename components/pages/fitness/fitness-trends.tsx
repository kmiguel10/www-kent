import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { FitnessSleepRecord, FitnessRecoveryRecord } from '@/pages/fitness';

const COLOR_SLEEP  = '#0090FF';
const COLOR_STRESS = '#f97316';
const COLOR_HRV    = '#22c55e';

type Point = {
  date: string;
  label: string;
  sleep: number | null;
  stress: number | null;
  hrv: number | null;
};

function rollingAvg(
  points: { date: string; value: number | null }[],
  window: number,
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (let i = 0; i < points.length; i++) {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1).map((p) => p.value).filter((v): v is number => v !== null);
    out.set(points[i].date, slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : null);
  }
  return out;
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-gray-12">{label}</div>
      {payload.map((p: any) => (
        p.value !== null && (
          <div key={p.dataKey} className="flex items-center gap-2 text-gray-11">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span>{p.name}</span>
            <span className="ml-auto font-medium text-gray-12">
              {Math.round(p.value)}{p.name === 'HRV' ? ' ms' : ''}
            </span>
          </div>
        )
      ))}
    </div>
  );
}

export default function FitnessTrends({
  sleep,
  recovery,
}: {
  sleep: FitnessSleepRecord[];
  recovery: FitnessRecoveryRecord[];
}) {
  const [days, setDays] = useState<90 | 180>(90);
  const WINDOW = 7;

  const data = useMemo((): Point[] => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const sleepMap = new Map(sleep.map((r) => [r.date, r.sleep_score]));
    const stressMap = new Map(recovery.map((r) => [r.date, r.stress_avg]));
    const hrvMap = new Map(recovery.map((r) => [r.date, r.hrv]));

    const allDates = Array.from(
      new Set([...sleepMap.keys(), ...stressMap.keys(), ...hrvMap.keys()])
    ).sort();

    const filtered = allDates.filter((d) => new Date(d) >= cutoff);

    const sleepPoints  = filtered.map((d) => ({ date: d, value: sleepMap.get(d)  ?? null }));
    const stressPoints = filtered.map((d) => ({ date: d, value: stressMap.get(d) ?? null }));
    const hrvPoints    = filtered.map((d) => ({ date: d, value: hrvMap.get(d)    ?? null }));

    const sleepAvg  = rollingAvg(sleepPoints,  WINDOW);
    const stressAvg = rollingAvg(stressPoints, WINDOW);
    const hrvAvg    = rollingAvg(hrvPoints,    WINDOW);

    return filtered.map((d) => {
      const date = new Date(d + 'T00:00:00Z');
      return {
        date: d,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        sleep:  sleepAvg.get(d)  ?? null,
        stress: stressAvg.get(d) ?? null,
        hrv:    hrvAvg.get(d)    ?? null,
      };
    });
  }, [sleep, recovery, days]);

  const xTick = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="flex flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-gray-11">{WINDOW}-day rolling averages</p>
        <div className="flex overflow-hidden rounded-md border border-gray-6">
          {([90, 180] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                'px-3 py-1 text-xs font-medium transition-colors',
                days === d ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3',
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
            tickLine={false}
            axisLine={false}
            interval={xTick}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip content={<ChartTip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-xs text-gray-11">{value}</span>}
          />
          <Line
            type="monotone"
            dataKey="sleep"
            name="Sleep Score"
            stroke={COLOR_SLEEP}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="stress"
            name="Avg Stress"
            stroke={COLOR_STRESS}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="hrv"
            name="HRV"
            stroke={COLOR_HRV}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-11">
        <span><span className="font-medium" style={{ color: COLOR_SLEEP }}>Sleep Score</span> · 0–100, higher is better</span>
        <span><span className="font-medium" style={{ color: COLOR_STRESS }}>Avg Stress</span> · 0–100, lower is better</span>
        <span><span className="font-medium" style={{ color: COLOR_HRV }}>HRV</span> · ms, higher is better</span>
      </div>
    </div>
  );
}
