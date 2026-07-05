import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Flag, Check, AlertTriangle } from 'lucide-react';

import { type GoalModel, fmtTime, fmtPace } from '@/lib/athlete-os/services/marathon/marathonGoal';

/**
 * Marathon Goal — the north-star tracker: countdown, live predicted finish, the
 * gap to target, required splits, a projection toward race day, and the three
 * levers that close the gap.
 */

const STATUS_COLOR = { good: '#10b981', warn: '#eab308', bad: '#f97316' } as const;

function fmtDelta(sec: number): string {
  const a = Math.abs(sec);
  const h = Math.floor(a / 3600), m = Math.round((a % 3600) / 60);
  return `${sec >= 0 ? '+' : '−'}${h > 0 ? `${h}h ` : ''}${m}m`;
}

export default function MarathonGoal({ model }: { model: GoalModel }) {
  const gap = model.gapSeconds;
  const predColor = gap == null ? 'var(--gray-12)' : gap <= 0 ? '#10b981' : gap < 30 * 60 ? '#eab308' : '#f97316';
  const raceDate = new Date('2027-01-31T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const chart = model.trend.map((t) => ({ month: t.month.slice(2), predicted: Math.round(t.predicted / 60) }));

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
        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${model.onTrack ? 'border-green-800 text-green-400' : 'border-orange-800 text-orange-400'}`}>
          {model.onTrack ? <Check size={13} /> : <AlertTriangle size={13} />}
          {model.onTrack ? 'On track at current rate' : 'Behind current projection'}
        </div>
      </div>

      {/* Prediction + gap + splits */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <motion.div className="col-span-2 flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-4 sm:col-span-1"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <span className="text-[10px] uppercase tracking-wider text-gray-10">Predicted finish</span>
          <span className="text-3xl font-semibold" style={{ color: predColor }}>{fmtTime(model.predictedSeconds)}</span>
          <span className="text-[10px] text-gray-10">{model.predictedFrom ? `from your ${model.predictedFrom} PR` : 'needs a recent effort'}</span>
        </motion.div>
        <Metric label="Gap to sub-4" value={gap != null ? fmtDelta(gap) : '—'} sub={gap != null && gap > 0 ? 'to cut' : 'ahead'} color={predColor} />
        <Metric label="Required half" value={fmtTime(model.requiredHalf)} sub={`${fmtPace(model.requiredHalf / 21.0975)}/km`} />
        <Metric label="Required 10K" value={fmtTime(model.required10k)} sub={`${fmtPace(model.required10k / 10)}/km`} />
      </div>

      {/* Projection chart */}
      {chart.length >= 2 && (
        <div className="rounded-xl border border-gray-6 bg-gray-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-11">Predicted marathon over time</span>
            <span className="text-[10px] text-gray-10">
              {model.currentImprovementPerMonth != null && model.currentImprovementPerMonth > 0
                ? `improving ~${Math.round(model.currentImprovementPerMonth / 60)} min/mo`
                : 'flat/needs a recent hard effort'}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chart} margin={{ top: 6, right: 10, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} width={40}
                domain={['dataMin - 10', 'dataMax + 10']} tickFormatter={(v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`} />
              <ReferenceLine y={model.targetSeconds / 60} stroke="#2dd4bf" strokeDasharray="5 4"
                label={{ value: 'sub-4', fill: '#2dd4bf', fontSize: 10, position: 'insideTopRight' }} />
              <Tooltip content={({ active, payload }) => active && payload?.length
                ? <div className="rounded border border-gray-6 bg-gray-2 px-2 py-1 text-xs text-gray-12">{(payload[0].payload as { month: string }).month}: {fmtTime((payload[0].value as number) * 60)}</div> : null} />
              <Line type="monotone" dataKey="predicted" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[10px] text-gray-10">Each point = the fastest marathon your best effort that month projects to (Riegel). Goal: bring the line down to the sub-4 marker by race day.</p>
        </div>
      )}

      {/* Levers */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">What closes the gap</span>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {model.levers.map((l) => (
            <div key={l.key} className="flex flex-col gap-1 rounded-xl border border-gray-6 bg-gray-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-11">{l.label}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[l.status] }} />
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

      {/* PRs */}
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
