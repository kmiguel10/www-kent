import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import FitnessWhoopSleepHeatmap from './fitness-whoop-sleep-heatmap';
import type { FitnessWhoopSleep } from '@/pages/fitness';

const STAGES = [
  { key: 'slow_wave_minutes', label: 'Deep (SWS)', color: '#4f46e5' },
  { key: 'rem_minutes', label: 'REM', color: '#0090FF' },
  { key: 'light_minutes', label: 'Light', color: '#38bdf8' },
  { key: 'awake_minutes', label: 'Awake', color: '#6b7280' },
] as const;

function fmt(value: number | null | undefined, digits = 0, unit = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(digits)}${unit}`;
}

function fmtHm(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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

function StageTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-gray-12">{label}</div>
      {[...payload].reverse().map((p: any) => {
        const stage = STAGES.find((s) => s.key === p.dataKey);
        if (!stage || !p.value) return null;
        return (
          <div key={p.dataKey} className="flex items-center gap-2 text-gray-11">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.color }} />
            <span className="flex-1">{stage.label}</span>
            <span className="ml-3 font-medium tabular-nums text-gray-12">{fmtHm(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function FitnessWhoopSleep({ sleep }: { sleep: FitnessWhoopSleep[] }) {
  const [days, setDays] = useState<14 | 30>(14);

  const nonNap = useMemo(() => sleep.filter((s) => !s.nap), [sleep]);
  const latest = nonNap[0];

  // Total asleep = in bed − awake (stage minutes for the latest night).
  const latestAsleep =
    latest?.in_bed_minutes != null && latest?.awake_minutes != null
      ? latest.in_bed_minutes - latest.awake_minutes
      : null;

  const chartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return nonNap
      .filter((s) => new Date(s.date) >= cutoff)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        label: new Date(s.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        slow_wave_minutes: s.slow_wave_minutes ?? 0,
        rem_minutes: s.rem_minutes ?? 0,
        light_minutes: s.light_minutes ?? 0,
        awake_minutes: s.awake_minutes ?? 0,
      }));
  }, [nonNap, days]);

  if (nonNap.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-sm text-gray-11">No WHOOP sleep data yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Performance"
          value={fmt(latest?.sleep_performance_percentage, 0, '%')}
          sub={latest ? new Date(latest.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : undefined}
        />
        <StatCard label="Efficiency" value={fmt(latest?.sleep_efficiency_percentage, 0, '%')} />
        <StatCard label="Consistency" value={fmt(latest?.sleep_consistency_percentage, 0, '%')} />
        <StatCard label="Time Asleep" value={fmtHm(latestAsleep)} sub={`in bed ${fmtHm(latest?.in_bed_minutes)}`} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="REM" value={fmtHm(latest?.rem_minutes)} />
        <StatCard label="Deep (SWS)" value={fmtHm(latest?.slow_wave_minutes)} />
        <StatCard label="Light" value={fmtHm(latest?.light_minutes)} />
        <StatCard label="Respiratory Rate" value={fmt(latest?.respiratory_rate, 1)} sub="breaths/min" />
      </div>

      <div className="rounded-xl border border-gray-6 bg-gray-2">
        <div className="border-b border-gray-7 px-4 py-3">
          <div className="text-sm font-medium text-gray-12">Sleep performance calendar</div>
          <div className="text-xs text-gray-11">Nightly sleep performance · this year</div>
        </div>
        <FitnessWhoopSleepHeatmap sleep={sleep} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-11">Sleep stages per night</p>
        <div className="flex overflow-hidden rounded-md border border-gray-6">
          {([14, 30] as const).map((d) => (
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
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--gray-11)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Math.round(v / 60)}h`}
          />
          <Tooltip content={<StageTip />} cursor={{ fill: 'var(--gray-4)' }} />
          {STAGES.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="sleep" fill={s.color} radius={s.key === 'slow_wave_minutes' ? [0, 0, 3, 3] : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {STAGES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-11">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
