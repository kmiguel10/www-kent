import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import { Flag, Check, AlertTriangle } from 'lucide-react';

import { type GoalModel, fmtTime, fmtPace } from '@/lib/athlete-os/services/marathon/marathonGoal';
import type { Roadmap } from '@/lib/athlete-os/services/marathon/roadmap';

/**
 * Marathon Goal — north-star tracker. The chart overlays your ACTUAL predicted
 * finish (from real efforts, since Jan 2026) against the TARGET glide path and
 * a PROJECTION at your current rate of improvement — so it directly answers
 * "am I on pace for sub-4?". Everything carries the pace (min/km) too.
 */

const paceOf = (sec: number) => sec / 42.195; // marathon pace from finish time
const START_MONTH = '2026-01';

function fmtDelta(sec: number): string {
  const a = Math.abs(sec);
  const h = Math.floor(a / 3600), m = Math.round((a % 3600) / 60);
  return `${sec >= 0 ? '+' : '−'}${h > 0 ? `${h}h ` : ''}${m}m`;
}
function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}
function monthLabel(m: string): string {
  return new Date(m + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export default function MarathonGoal({ model, roadmap }: { model: GoalModel; roadmap: Roadmap }) {
  const gap = model.gapSeconds;
  const predColor = gap == null ? 'var(--gray-12)' : gap <= 0 ? '#10b981' : gap < 30 * 60 ? '#eab308' : '#f97316';
  const raceDate = new Date('2027-01-31T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const nowMonth = new Date().toISOString().slice(0, 7);

  // ── Combined actual / target / projection, monthly from Jan 2026 → race ─────
  const actualByMonth = new Map(model.trend.map((t) => [t.month, t.predicted]));
  const targetByMonth = new Map(roadmap.checkpoints.map((c) => [c.date.slice(0, 7), c.predictedSec]));
  const lastActual = model.trend.length ? model.trend[model.trend.length - 1].predicted : null;
  const rate = model.currentImprovementPerMonth ?? 0; // sec/mo (positive = getting faster)

  const months: string[] = [];
  for (let d = new Date(START_MONTH + '-01T00:00:00Z'); d <= new Date('2027-01-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1)) {
    months.push(d.toISOString().slice(0, 7));
  }
  const chart = months.map((m) => {
    const row: { m: string; label: string; actual?: number; target?: number; projection?: number } = { m, label: monthLabel(m) };
    const a = actualByMonth.get(m);
    if (a != null) row.actual = Math.round(a / 60);
    const t = targetByMonth.get(m);
    if (t != null) row.target = Math.round(t / 60);
    if (m >= nowMonth && lastActual != null && rate !== 0) {
      row.projection = Math.round((lastActual - rate * monthDiff(nowMonth, m)) / 60);
    }
    return row;
  });
  const targetMin = model.targetSeconds / 60;
  const currentMin = model.predictedSeconds != null ? Math.round(model.predictedSeconds / 60) : null;
  const currentPace = model.predictedSeconds != null ? fmtPace(paceOf(model.predictedSeconds)) : null;
  // Shared Y domain so the time (left) and pace (right) axes line up.
  const chartVals = chart.flatMap((r) => [r.actual, r.target, r.projection].filter((v): v is number => v != null));
  const maxVal = Math.max(targetMin, currentMin ?? 0, ...chartVals);
  const yDomain: [number, number] = [Math.floor(targetMin - 4), Math.ceil(maxVal + 6)];
  const timeTick = (v: number) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`;
  const paceTick = (v: number) => fmtPace(paceOf(v * 60));

  // Are we improving fast enough?
  const needed = model.neededImprovementPerMonth; // sec/mo required
  const onPace = rate > 0 && needed != null && rate >= needed;

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Hero row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-6 bg-gray-2" style={{ color: '#2dd4bf' }}>
            <Flag size={20} />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-12">{model.label}</div>
            <div className="text-xs text-gray-10">{raceDate} · {model.weeksToRace} weeks out · target {fmtTime(model.targetSeconds)} ({fmtPace(model.marathonPaceSecPerKm)}/km)</div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${onPace ? 'border-green-800 text-green-400' : 'border-orange-800 text-orange-400'}`}>
          {onPace ? <Check size={13} /> : <AlertTriangle size={13} />}
          {onPace ? 'On pace at current rate' : 'Behind target pace'}
        </div>
      </div>

      {/* Prediction + gap + splits (with pace) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <motion.div className="col-span-2 flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-4 sm:col-span-1"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <span className="text-[10px] uppercase tracking-wider text-gray-10">Predicted finish</span>
          <span className="text-3xl font-semibold" style={{ color: predColor }}>{fmtTime(model.predictedSeconds)}</span>
          <span className="text-[10px] text-gray-10">{model.predictedSeconds != null ? `${fmtPace(paceOf(model.predictedSeconds))}/km` : ''}{model.predictedFrom ? ` · from your ${model.predictedFrom}` : ''}</span>
        </motion.div>
        <Metric label="Gap to sub-4" value={gap != null ? fmtDelta(gap) : '—'}
          sub={model.predictedSeconds != null ? `${fmtPace(paceOf(model.predictedSeconds) - model.marathonPaceSecPerKm)}/km faster needed` : ''} color={predColor} />
        <Metric label="Required half" value={fmtTime(model.requiredHalf)} sub={`${fmtPace(model.requiredHalf / 21.0975)}/km`} />
        <Metric label="Required 10K" value={fmtTime(model.required10k)} sub={`${fmtPace(model.required10k / 10)}/km`} />
      </div>

      {/* Live tracking chart: actual vs target vs projection */}
      <div className="rounded-xl border border-gray-6 bg-gray-2 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-11">Are you on pace? · actual vs target since Jan 2026</span>
          <span className="text-[10px] text-gray-10">
            {rate > 0 ? `improving ~${fmtPace(rate)}/mo faster` : 'need a recent hard effort'}
            {needed != null ? ` · need ~${fmtPace(needed)}/mo` : ''}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chart} margin={{ top: 8, right: 4, bottom: 0, left: -4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis yAxisId="time" width={46} domain={yDomain} tickFormatter={timeTick} tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="pace" orientation="right" width={52} domain={yDomain} tickFormatter={paceTick}
              tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false}
              label={{ value: 'pace /km', angle: 90, position: 'insideRight', fill: 'var(--gray-10)', fontSize: 9 }} />
            <ReferenceLine yAxisId="time" y={targetMin} stroke="#2dd4bf" strokeDasharray="5 4"
              label={{ value: `sub-4 · ${fmtPace(model.marathonPaceSecPerKm)}/km`, fill: '#2dd4bf', fontSize: 10, position: 'insideTopRight' }} />
            {currentMin != null && (
              <ReferenceLine yAxisId="time" y={currentMin} stroke="#f97316" strokeDasharray="2 3"
                label={{ value: `now · ${currentPace}/km`, fill: '#f97316', fontSize: 10, position: 'insideBottomRight' }} />
            )}
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const rows = payload.filter((p) => p.value != null);
              if (!rows.length) return null;
              return (
                <div className="rounded border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-md">
                  <div className="mb-1 font-medium text-gray-12">{label}</div>
                  {rows.map((p) => (
                    <div key={p.dataKey as string} className="flex items-center gap-2 text-gray-11">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      <span className="flex-1 capitalize">{p.dataKey as string}</span>
                      <span className="text-gray-12">{fmtTime((p.value as number) * 60)} · {fmtPace(paceOf((p.value as number) * 60))}/km</span>
                    </div>
                  ))}
                </div>
              );
            }} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="plainline" />
            <Line yAxisId="time" type="monotone" dataKey="actual" name="Actual" stroke="#0090FF" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            <Line yAxisId="time" type="monotone" dataKey="projection" name="At current rate" stroke="#f97316" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            <Line yAxisId="time" type="monotone" dataKey="target" name="Target" stroke="#2dd4bf" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[10px] text-gray-10">
          Left axis = finish time, right axis = pace (min/km). Orange line = your current pace ({currentPace ?? '—'}/km); teal = the sub-4 target ({fmtPace(model.marathonPaceSecPerKm)}/km). Blue = actual, orange dashed = where you land at your current rate. Close the gap between the two horizontal lines.
        </p>
      </div>

      {/* Levers */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">What closes the gap</span>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {model.levers.map((l) => (
            <div key={l.key} className="flex flex-col gap-1 rounded-xl border border-gray-6 bg-gray-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-11">{l.label}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: l.status === 'good' ? '#10b981' : l.status === 'warn' ? '#eab308' : '#f97316' }} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold text-gray-12">{l.value}</span>
                <span className="text-[10px] text-gray-10">/ {l.target}</span>
              </div>
              <span className="text-[10px] text-gray-10">{l.hint}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PRs with pace */}
      {model.prs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-10">
          <span className="font-medium text-gray-11">PRs:</span>
          {model.prs.filter((p) => ['5k', '10k', '10 mile', 'Half-Marathon', 'Marathon'].includes(p.name)).map((p) => (
            <span key={p.name}>{p.name} <span className="text-gray-12">{fmtTime(p.seconds)}</span> ({fmtPace(p.paceSecPerKm)}/km)</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-4">
      <span className="text-[10px] uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-2xl font-semibold text-gray-12" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="text-[10px] text-gray-10">{sub}</span>}
    </div>
  );
}
