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
} from 'recharts';
import type {
  FitnessWhoopRecovery,
  FitnessWhoopSleep,
  FitnessWhoopCycle,
} from '@/pages/fitness';

type MetricKey = 'recovery' | 'sleep_performance' | 'hrv' | 'resting_hr' | 'respiratory_rate' | 'strain';

const METRICS: Record<MetricKey, { label: string; color: string; unit: string; hint: string; axis: 'left' | 'right' }> = {
  recovery:          { label: 'Recovery',        color: '#16a34a', unit: '%',   hint: '0–100, higher is better',   axis: 'left' },
  sleep_performance: { label: 'Sleep Perf.',      color: '#0090FF', unit: '%',   hint: '% of sleep need met',        axis: 'left' },
  hrv:               { label: 'HRV',             color: '#22c55e', unit: ' ms', hint: 'rMSSD, higher is better',    axis: 'left' },
  resting_hr:        { label: 'Resting HR',       color: '#f43f5e', unit: ' bpm',hint: 'lower is better',            axis: 'left' },
  respiratory_rate:  { label: 'Respiratory',      color: '#06b6d4', unit: ' rpm',hint: 'breaths/min during sleep',   axis: 'left' },
  strain:            { label: 'Day Strain',       color: '#a855f7', unit: '',    hint: '0–21 scale',                 axis: 'right' },
};

const METRIC_ORDER: MetricKey[] = ['recovery', 'sleep_performance', 'hrv', 'resting_hr', 'respiratory_rate', 'strain'];
const DEFAULT_ACTIVE = new Set<MetricKey>(['recovery', 'sleep_performance', 'strain']);

function rollingAvg(points: { date: string; value: number | null }[], window: number): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (let i = 0; i < points.length; i++) {
    const slice = points
      .slice(Math.max(0, i - window + 1), i + 1)
      .map((p) => p.value)
      .filter((v): v is number => v !== null);
    out.set(points[i].date, slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : null);
  }
  return out;
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((p: any) => p.value !== null && p.value !== undefined);
  if (!visible.length) return null;
  return (
    <div className="rounded border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-gray-12">{label}</div>
      {visible.map((p: any) => {
        const meta = METRICS[p.dataKey as MetricKey];
        return (
          <div key={p.dataKey} className="flex items-center gap-2 text-gray-11">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="flex-1">{meta?.label ?? p.dataKey}</span>
            <span className="ml-3 font-medium tabular-nums text-gray-12">
              {meta?.axis === 'right' ? p.value.toFixed(1) : Math.round(p.value)}{meta?.unit ?? ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function FitnessWhoopTrends({
  recovery,
  sleep,
  cycles,
}: {
  recovery: FitnessWhoopRecovery[];
  sleep: FitnessWhoopSleep[];
  cycles: FitnessWhoopCycle[];
}) {
  const [days, setDays] = useState<90 | 180>(90);
  const [active, setActive] = useState<Set<MetricKey>>(DEFAULT_ACTIVE);
  const WINDOW = 7;

  const toggle = (key: MetricKey) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const data = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const nonNap = sleep.filter((s) => !s.nap);
    const recoveryMap = new Map(recovery.map((r) => [r.date, r.recovery_score]));
    const sleepPerfMap = new Map(nonNap.map((s) => [s.date, s.sleep_performance_percentage]));
    const hrvMap = new Map(recovery.map((r) => [r.date, r.hrv_rmssd_milli]));
    const hrMap = new Map(recovery.map((r) => [r.date, r.resting_heart_rate]));
    const respMap = new Map(nonNap.map((s) => [s.date, s.respiratory_rate]));
    const strainMap = new Map(cycles.map((c) => [c.date, c.strain]));

    const allDates = Array.from(
      new Set([
        ...Array.from(recoveryMap.keys()),
        ...Array.from(sleepPerfMap.keys()),
        ...Array.from(strainMap.keys()),
      ]),
    ).sort().filter((d) => new Date(d) >= cutoff);

    const avgs = {
      recovery:          rollingAvg(allDates.map((d) => ({ date: d, value: recoveryMap.get(d)  ?? null })), WINDOW),
      sleep_performance: rollingAvg(allDates.map((d) => ({ date: d, value: sleepPerfMap.get(d) ?? null })), WINDOW),
      hrv:               rollingAvg(allDates.map((d) => ({ date: d, value: hrvMap.get(d)        ?? null })), WINDOW),
      resting_hr:        rollingAvg(allDates.map((d) => ({ date: d, value: hrMap.get(d)         ?? null })), WINDOW),
      respiratory_rate:  rollingAvg(allDates.map((d) => ({ date: d, value: respMap.get(d)       ?? null })), WINDOW),
      strain:            rollingAvg(allDates.map((d) => ({ date: d, value: strainMap.get(d)     ?? null })), WINDOW),
    };

    return allDates.map((d) => ({
      date: d,
      label: new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      recovery:          avgs.recovery.get(d)          ?? null,
      sleep_performance: avgs.sleep_performance.get(d) ?? null,
      hrv:               avgs.hrv.get(d)               ?? null,
      resting_hr:        avgs.resting_hr.get(d)        ?? null,
      respiratory_rate:  avgs.respiratory_rate.get(d)  ?? null,
      strain:            avgs.strain.get(d)            ?? null,
    }));
  }, [recovery, sleep, cycles, days]);

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

      <div className="mb-4 flex flex-wrap gap-2">
        {METRIC_ORDER.map((key) => {
          const { label, color } = METRICS[key];
          const on = active.has(key);
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={clsx(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                on ? 'border-gray-6 bg-gray-3 text-gray-12' : 'border-gray-6 text-gray-10 hover:bg-gray-3 hover:text-gray-11',
              )}
            >
              <span className="h-2 w-2 rounded-full transition-opacity" style={{ background: color, opacity: on ? 1 : 0.3 }} />
              {label}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: -16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
            tickLine={false}
            axisLine={false}
            interval={xTick}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={false} domain={[0, 100]} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={false} domain={[0, 21]} />
          <Tooltip content={<ChartTip />} />
          {METRIC_ORDER.filter((key) => active.has(key)).map((key) => (
            <Line
              key={key}
              yAxisId={METRICS[key].axis}
              type="monotone"
              dataKey={key}
              stroke={METRICS[key].color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {METRIC_ORDER.filter((key) => active.has(key)).map((key) => {
          const { label, color, hint } = METRICS[key];
          return (
            <span key={key} className="text-xs text-gray-11">
              <span className="font-medium" style={{ color }}>{label}</span>
              {' · '}{hint}
            </span>
          );
        })}
      </div>
    </div>
  );
}
