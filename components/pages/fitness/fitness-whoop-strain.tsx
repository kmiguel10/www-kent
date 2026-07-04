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
  Cell,
} from 'recharts';
import FitnessWhoopStrainHeatmap from './fitness-whoop-strain-heatmap';
import type { FitnessWhoopCycle, FitnessWhoopRecovery } from '@/pages/fitness';

function fmt(value: number | null | undefined, digits = 0, unit = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(digits)}${unit}`;
}

// WHOOP strain zones: light (0–9), moderate (10–13), strenuous (14–17), all-out (18–21).
function strainColor(strain: number): string {
  if (strain >= 18) return '#ef4444';
  if (strain >= 14) return '#f97316';
  if (strain >= 10) return '#a855f7';
  return '#6366f1';
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

function StrainTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  if (p.value == null) return null;
  return (
    <div className="rounded border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-gray-12">{label}</div>
      <div className="flex items-center gap-2 text-gray-11">
        <span className="h-2 w-2 rounded-full" style={{ background: strainColor(p.value) }} />
        <span className="flex-1">Day strain</span>
        <span className="ml-3 font-medium tabular-nums text-gray-12">{p.value.toFixed(1)}</span>
      </div>
    </div>
  );
}

export default function FitnessWhoopStrain({
  cycles,
  recovery,
}: {
  cycles: FitnessWhoopCycle[];
  recovery: FitnessWhoopRecovery[];
}) {
  const [days, setDays] = useState<14 | 30>(14);

  const latest = cycles[0];

  // WHOOP reports energy in kilojoules; dietary calories ≈ kJ / 4.184.
  const latestCalories = latest?.kilojoules != null ? latest.kilojoules / 4.184 : null;

  const avgStrain = useMemo(() => {
    const vals = cycles.map((c) => c.strain).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [cycles]);

  const chartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cycles
      .filter((c) => new Date(c.date) >= cutoff)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((c) => ({
        label: new Date(c.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        strain: c.strain ?? 0,
      }));
  }, [cycles, days]);

  if (cycles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-sm text-gray-11">No WHOOP strain data yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Day Strain"
          value={fmt(latest?.strain, 1)}
          sub={latest ? new Date(latest.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : undefined}
        />
        <StatCard label="Avg Strain" value={fmt(avgStrain, 1)} sub={`${cycles.length}-day`} />
        <StatCard label="Energy" value={latestCalories != null ? `${(latestCalories / 1000).toFixed(1)}k` : '—'} sub="kcal" />
        <StatCard label="Avg / Max HR" value={`${fmt(latest?.avg_heart_rate)} / ${fmt(latest?.max_heart_rate)}`} sub="bpm" />
      </div>

      <div className="rounded-xl border border-gray-6 bg-gray-2">
        <div className="border-b border-gray-7 px-4 py-3">
          <div className="text-sm font-medium text-gray-12">Strain calendar</div>
          <div className="text-xs text-gray-11">Daily strain load · this year</div>
        </div>
        <FitnessWhoopStrainHeatmap cycles={cycles} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-11">Day strain (0–21)</p>
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
          <YAxis tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={false} domain={[0, 21]} />
          <Tooltip content={<StrainTip />} cursor={{ fill: 'var(--gray-4)' }} />
          <Bar dataKey="strain" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={strainColor(d.strain)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-xs text-gray-11"><span className="h-2 w-2 rounded-full" style={{ background: '#6366f1' }} />Light 0–9</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-11"><span className="h-2 w-2 rounded-full" style={{ background: '#a855f7' }} />Moderate 10–13</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-11"><span className="h-2 w-2 rounded-full" style={{ background: '#f97316' }} />Strenuous 14–17</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-11"><span className="h-2 w-2 rounded-full" style={{ background: '#ef4444' }} />All-out 18–21</span>
      </div>
    </div>
  );
}
