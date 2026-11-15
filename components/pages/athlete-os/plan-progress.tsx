import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { AlertTriangle, Check } from 'lucide-react';

import type { PlanPayload } from '@/pages/api/athlete-os/plan';
import { StatusChip, fmtDay } from './plan-ui';

/**
 * Plan vs actual — weekly running km against the Runna plan, plus the long-run
 * ladder to race day with factual flags (big step-ups, back-to-back long runs).
 */
export default function PlanProgress({ plan }: { plan: PlanPayload }) {
  const chart = plan.weeks.map((w) => {
    const longPlan = plan.runs.find((r) => r.week === w.week && (r.workoutType === 'long' || r.workoutType === 'race'));
    return {
      label: `W${w.week}`,
      planned: w.plannedKm,
      actual: w.start <= plan.today ? w.actualKm : null,
      longPlanned: longPlan?.plannedDistanceKm ?? null,
      longActual: longPlan?.actual?.km ?? null,
    };
  });

  const longs = plan.runs.filter((r) => r.workoutType === 'long' || r.workoutType === 'race');
  let longestDone = plan.longestRecentKm;
  const ladder = longs.map((r, i) => {
    const flags: string[] = [];
    if (r.date >= plan.today && r.workoutType === 'long') {
      if (r.plannedDistanceKm > longestDone * 1.3) flags.push(`Step up: +${Math.round(r.plannedDistanceKm - longestDone)} km over your longest recent run (${longestDone} km)`);
      const prev = longs[i - 1];
      if (prev && prev.plannedDistanceKm >= 28 && r.plannedDistanceKm >= 28) flags.push(`Back-to-back with last week’s ${prev.plannedDistanceKm} km — check fatigue before going full distance`);
    }
    if (r.actual) longestDone = Math.max(longestDone, r.actual.km);
    else if (r.date >= plan.today && r.workoutType === 'long') longestDone = Math.max(longestDone, r.plannedDistanceKm); // assume completion for later step-up checks
    return { r, flags };
  });

  const elapsed = plan.load.adherenceWeeks;
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap gap-4 text-xs text-gray-11">
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-sm border border-sky-500" />} label="Planned km" />
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />} label="Run km (Garmin)" />
        <Legend swatch={<span className="w-3.5 border-t-2 border-dashed border-orange-500" />} label="Planned long run" />
        <Legend swatch={<span className="h-2.5 w-2.5 rounded-full bg-orange-500" />} label="Long run done" />
        {plan.load.adherence != null && (
          <span className="ml-auto text-gray-10">
            Adherence: <span className="font-medium text-gray-12">{Math.round(plan.load.adherence * 100)}%</span> of planned km over {elapsed} completed plan week{elapsed === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={chart} margin={{ top: 6, right: 6, bottom: 0, left: -10 }} barGap={-16}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} unit=" km" width={48} />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as typeof chart[number];
            return (
              <div className="rounded border border-gray-6 bg-gray-2 px-2.5 py-1.5 text-xs text-gray-12">
                <div className="font-medium">{label}</div>
                <div>Week: {p.actual != null ? `${p.actual} / ` : ''}{p.planned} km</div>
                {p.longPlanned != null && <div>Long run: {p.longActual != null ? `${p.longActual.toFixed(1)} / ` : ''}{p.longPlanned} km</div>}
              </div>
            );
          }} />
          <Bar dataKey="planned" fill="rgba(14,165,233,0.10)" stroke="#0ea5e9" strokeWidth={1} barSize={16} radius={[3, 3, 0, 0]} />
          <Bar dataKey="actual" fill="#0ea5e9" barSize={16} radius={[3, 3, 0, 0]} />
          <Line dataKey="longPlanned" stroke="#f97316" strokeDasharray="5 4" strokeWidth={2} dot={false} />
          <Line dataKey="longActual" stroke="none" dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">Long-run ladder to race day</span>
        <div className="flex flex-col divide-y divide-gray-6 rounded-xl border border-gray-6">
          {ladder.map(({ r, flags }) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
              <span className="w-10 font-medium text-gray-11">W{r.week}</span>
              <span className="w-20 text-gray-10">{fmtDay(r.date, { month: 'short', day: 'numeric' })}</span>
              <span className="w-14 font-semibold text-gray-12">{r.plannedDistanceKm} km</span>
              <span className="min-w-[140px] flex-1 text-gray-11">{r.workoutName}</span>
              {r.actual && <span className="text-gray-10">{r.actual.km.toFixed(1)} km done</span>}
              <StatusChip status={r.status} />
              {flags.map((f, i) => (
                <span key={i} className="flex basis-full items-center gap-1 pl-[13.5rem] text-[11px] text-amber-400 max-sm:pl-0"><AlertTriangle size={11} />{f}</span>
              ))}
              {r.status === 'completed' && !flags.length && <Check size={12} className="text-emerald-400" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return <span className="flex items-center gap-1.5">{swatch}{label}</span>;
}
