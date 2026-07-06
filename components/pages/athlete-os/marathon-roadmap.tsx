import {
  ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

import type { Roadmap, Phase } from '@/lib/athlete-os/services/marathon/roadmap';
import { fmtTime, fmtPace } from '@/lib/athlete-os/services/marathon/marathonGoal';

/**
 * Marathon roadmap — the glide path to sub-4 with monthly checkpoints of the
 * target stats. Answers "what should my numbers be N months out?"
 */

const PHASE_COLOR: Record<Phase, string> = { base: '#0090FF', build: '#a855f7', peak: '#f97316', taper: '#10b981' };
const fmtMin = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;
const shortDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

export default function MarathonRoadmap({ roadmap }: { roadmap: Roadmap }) {
  const targetMin = roadmap.targetSec / 60;
  const line = roadmap.trajectory.map((t) => ({ date: t.date, target: t.predictedMin }));
  // One X tick per month (the trajectory is sampled every 2 weeks, which would
  // otherwise print the same month label twice).
  const monthTicks = (() => {
    const seen = new Set<string>(); const out: string[] = [];
    for (const p of line) { const mo = p.date.slice(0, 7); if (!seen.has(mo)) { seen.add(mo); out.push(p.date); } }
    return out;
  })();
  // "You are here" — current actual predicted at today.
  const nowPoint = roadmap.current.predictedSec != null
    ? [{ date: line[0]?.date, you: Math.round(roadmap.current.predictedSec / 60) }]
    : [];

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Glide-path chart */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">Glide path to sub-4</span>
          <span className="text-[10px] text-gray-10">{roadmap.weeksToRace} weeks to race</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={line} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
            <XAxis dataKey="date" ticks={monthTicks} tickFormatter={shortDate} tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} />
            <YAxis domain={[targetMin - 6, 'dataMax + 6']} tickFormatter={fmtMin} tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} width={44} />
            <ReferenceLine y={targetMin} stroke="#2dd4bf" strokeDasharray="5 4" label={{ value: 'sub-4', fill: '#2dd4bf', fontSize: 10, position: 'insideTopRight' }} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { date: string; target: number };
              return <div className="rounded border border-gray-6 bg-gray-2 px-2 py-1 text-xs text-gray-12">{p.date}: target {fmtTime(p.target * 60)}</div>;
            }} />
            <Line type="monotone" dataKey="target" stroke="#2dd4bf" strokeWidth={2} dot={false} name="Target" />
            {nowPoint.length > 0 && <Scatter data={nowPoint} dataKey="you" fill="#f97316" name="You are here" />}
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-1 flex items-center gap-4 text-[10px] text-gray-10">
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded" style={{ background: '#2dd4bf' }} />target finish</span>
          {nowPoint.length > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#f97316' }} />you today ({fmtTime(roadmap.current.predictedSec!)})</span>}
        </div>
      </div>

      {/* Checkpoint cards */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">Checkpoints · target stats by date</span>
        <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
          {roadmap.checkpoints.map((c) => (
            <div key={c.monthsOut} className="flex min-w-[150px] flex-1 flex-col gap-2 rounded-xl border border-gray-6 bg-gray-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-12">{c.label}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase" style={{ color: PHASE_COLOR[c.phase], background: 'var(--gray-3)' }}>{c.phase}</span>
              </div>
              <span className="text-[10px] text-gray-10">{shortDate(c.date)} {new Date(c.date + 'T00:00:00Z').getUTCFullYear()}</span>
              <Row label="Finish" value={fmtTime(c.predictedSec)} highlight={c.monthsOut === 0} />
              <Row label="Pace" value={`${fmtPace(c.paceSecPerKm)}/km`} />
              <Row label="Volume" value={`${c.volumeKm} km/wk`} />
              <Row label="Long run" value={`${c.longestKm} km`} />
              <Row label="Easy" value={`${c.aerobicPct}%`} />
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-gray-10">
          A reverse-periodized sub-4 build: base → build → peak (~3–5 wks out) → taper. These are targets to train toward, not a guarantee — but if you hit them, the finish time follows.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-10">{label}</span>
      <span className={highlight ? 'font-semibold text-teal-400' : 'font-medium text-gray-12'}>{value}</span>
    </div>
  );
}
