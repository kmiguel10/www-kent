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
import type { FitnessSleepRecord, FitnessRecoveryRecord } from '@/pages/fitness';

// ── Metric definitions ────────────────────────────────────────────────────

type MetricKey = 'sleep' | 'stress' | 'hrv' | 'resting_hr' | 'sleep_dur' | 'body_battery' | 'readiness';

const METRICS: Record<MetricKey, { label: string; color: string; unit: string; hint: string }> = {
  sleep:        { label: 'Sleep Score',         color: '#0090FF', unit: '',     hint: '0–100, higher is better' },
  stress:       { label: 'Avg Stress',           color: '#f97316', unit: '',     hint: '0–100, lower is better' },
  hrv:          { label: 'HRV',                  color: '#22c55e', unit: ' ms',  hint: 'higher is better' },
  resting_hr:   { label: 'Resting HR',           color: '#f43f5e', unit: ' bpm', hint: 'lower is better' },
  sleep_dur:    { label: 'Sleep Duration',       color: '#a855f7', unit: '%',    hint: '% of 8h target' },
  body_battery: { label: 'Body Battery',         color: '#eab308', unit: '',     hint: '0–100, morning peak after sleep' },
  readiness:    { label: 'Training Readiness',   color: '#14b8a6', unit: '',     hint: '0–100, Garmin composite score' },
};

const METRIC_ORDER: MetricKey[] = ['sleep', 'stress', 'hrv', 'resting_hr', 'sleep_dur', 'body_battery', 'readiness'];
const DEFAULT_ACTIVE = new Set<MetricKey>(['sleep', 'stress', 'hrv']);

// ── Rolling average helper ────────────────────────────────────────────────

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

// ── Tooltip ───────────────────────────────────────────────────────────────

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
              {Math.round(p.value)}{meta?.unit ?? ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function FitnessTrends({
  sleep,
  recovery,
}: {
  sleep: FitnessSleepRecord[];
  recovery: FitnessRecoveryRecord[];
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

    const sleepMap     = new Map(sleep.map((r) => [r.date, r.sleep_score]));
    const durMap       = new Map(sleep.map((r) => [r.date, r.duration_minutes != null ? Math.min(100, (r.duration_minutes / 480) * 100) : null]));
    const stressMap    = new Map(recovery.map((r) => [r.date, r.stress_avg]));
    const hrvMap       = new Map(recovery.map((r) => [r.date, r.hrv]));
    const hrMap        = new Map(recovery.map((r) => [r.date, r.resting_hr]));
    const batteryMap   = new Map(recovery.map((r) => [r.date, r.body_battery_high]));
    const readyMap     = new Map(recovery.map((r) => [r.date, r.training_readiness]));

    const allDates = Array.from(
      new Set([...sleepMap.keys(), ...stressMap.keys(), ...hrvMap.keys()])
    ).sort().filter((d) => new Date(d) >= cutoff);

    const avgs = {
      sleep:        rollingAvg(allDates.map((d) => ({ date: d, value: sleepMap.get(d)   ?? null })), WINDOW),
      stress:       rollingAvg(allDates.map((d) => ({ date: d, value: stressMap.get(d)  ?? null })), WINDOW),
      hrv:          rollingAvg(allDates.map((d) => ({ date: d, value: hrvMap.get(d)      ?? null })), WINDOW),
      resting_hr:   rollingAvg(allDates.map((d) => ({ date: d, value: hrMap.get(d)       ?? null })), WINDOW),
      sleep_dur:    rollingAvg(allDates.map((d) => ({ date: d, value: durMap.get(d)      ?? null })), WINDOW),
      body_battery: rollingAvg(allDates.map((d) => ({ date: d, value: batteryMap.get(d) ?? null })), WINDOW),
      readiness:    rollingAvg(allDates.map((d) => ({ date: d, value: readyMap.get(d)    ?? null })), WINDOW),
    };

    return allDates.map((d) => {
      const label = new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', timeZone: 'UTC',
      });
      return {
        date: d,
        label,
        sleep:        avgs.sleep.get(d)        ?? null,
        stress:       avgs.stress.get(d)       ?? null,
        hrv:          avgs.hrv.get(d)           ?? null,
        resting_hr:   avgs.resting_hr.get(d)   ?? null,
        sleep_dur:    avgs.sleep_dur.get(d)     ?? null,
        body_battery: avgs.body_battery.get(d)  ?? null,
        readiness:    avgs.readiness.get(d)     ?? null,
      };
    });
  }, [sleep, recovery, days]);

  const xTick = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="flex flex-col p-4">
      {/* Controls row */}
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

      {/* Metric toggles */}
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
                on
                  ? 'border-gray-6 bg-gray-3 text-gray-12'
                  : 'border-gray-6 text-gray-10 hover:bg-gray-3 hover:text-gray-11',
              )}
            >
              <span
                className="h-2 w-2 rounded-full transition-opacity"
                style={{ background: color, opacity: on ? 1 : 0.3 }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
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
          {METRIC_ORDER.filter((key) => active.has(key)).map((key) => (
            <Line
              key={key}
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

      {/* Legend hints for active metrics */}
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
