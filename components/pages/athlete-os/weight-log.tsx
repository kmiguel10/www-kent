import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';

import type { WeightEntry } from '@/pages/api/athlete-os/weight';

/**
 * Manual bodyweight log with trend + power-to-weight. Feeds the 165–170 lb
 * body-composition goal (the target band is shaded on the chart).
 */

const GOAL_LOW = 165;
const GOAL_HIGH = 170;
const LB_PER_KG = 2.2046226218;

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function WeightLog({ ftp }: { ftp: number | null }) {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => fetch('/api/athlete-os/weight').then((r) => r.json()).then((d) => setEntries(d.entries ?? []));
  useEffect(() => { load(); }, []);

  const latest = entries[entries.length - 1];
  const wattsPerKg = useMemo(() => {
    if (!ftp || !latest) return null;
    return ftp / (latest.weightLb / LB_PER_KG);
  }, [ftp, latest]);

  const trend = useMemo(() => {
    if (entries.length < 2) return null;
    const first = entries[0].weightLb, last = latest.weightLb;
    return last - first;
  }, [entries, latest]);

  async function save() {
    setError(null);
    const w = Number(weight);
    if (!Number.isFinite(w) || w < 50 || w > 500) { setError('Enter a weight between 50 and 500 lb.'); return; }
    setSaving(true);
    const res = await fetch('/api/athlete-os/weight', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date, weightLb: w }),
    });
    setSaving(false);
    if (res.ok) { setWeight(''); load(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Save failed. Has the weight_log table been created?'); }
  }

  const chartData = entries.map((e) => ({ date: e.date, w: e.weightLb }));
  const inGoal = latest && latest.weightLb >= GOAL_LOW && latest.weightLb <= GOAL_HIGH;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Stats + entry */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Stat label="Latest" value={latest ? `${latest.weightLb.toFixed(1)} lb` : '—'} sub={latest?.date} color={inGoal ? '#10b981' : undefined} />
          <Stat label="To goal" value={latest ? (inGoal ? 'in range' : `${(latest.weightLb - GOAL_HIGH > 0 ? latest.weightLb - GOAL_HIGH : GOAL_LOW - latest.weightLb).toFixed(1)} lb`) : '—'}
            sub={`${GOAL_LOW}–${GOAL_HIGH} lb`} />
          <Stat label="Trend" value={trend != null ? `${trend >= 0 ? '+' : ''}${trend.toFixed(1)} lb` : '—'} sub="since first log" />
          <Stat label="Power-to-weight" value={wattsPerKg ? `${wattsPerKg.toFixed(1)} W/kg` : '—'} sub={ftp ? `at ${ftp}W FTP` : 'need FTP'} color="#a855f7" />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-10">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-gray-6 bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none focus:border-gray-8" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-10">Weight (lb)</span>
            <input type="number" step="0.1" value={weight} placeholder="e.g. 172" onChange={(e) => setWeight(e.target.value)}
              className="w-24 rounded-md border border-gray-6 bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none focus:border-gray-8" />
          </label>
          <button onClick={save} disabled={saving}
            className="rounded-md border border-gray-7 bg-gray-4 px-4 py-1.5 text-sm font-medium text-gray-12 transition-colors hover:bg-gray-5 disabled:opacity-50">
            {saving ? 'Saving…' : 'Log'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Trend chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
            <ReferenceArea y1={GOAL_LOW} y2={GOAL_HIGH} fill="#10b981" fillOpacity={0.12} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={false}
              tickFormatter={(d) => (d as string).slice(5)} minTickGap={30} />
            <YAxis domain={['dataMin - 3', 'dataMax + 3']} tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={false} width={40} unit=" lb" />
            <Tooltip content={({ active, payload }) => active && payload?.length
              ? <div className="rounded border border-gray-6 bg-gray-2 px-2 py-1 text-xs text-gray-12">{(payload[0].payload as { date: string }).date}: {payload[0].value} lb</div> : null} />
            <Line type="monotone" dataKey="w" stroke="#0090FF" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-6 bg-gray-2 px-4 py-6 text-center text-sm text-gray-10">
          No weight logged yet. Add an entry above — the shaded band is your {GOAL_LOW}–{GOAL_HIGH} lb goal.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-lg font-semibold" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="text-[10px] text-gray-10">{sub}</span>}
    </div>
  );
}
