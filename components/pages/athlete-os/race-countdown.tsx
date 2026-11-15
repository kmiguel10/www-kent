import { CalendarClock } from 'lucide-react';

import type { PlanPayload } from '@/pages/api/athlete-os/plan';
import { PHASES } from '@/lib/athlete-os/plan/miami2027';
import { PHASE_COLOR, daysBetween, fmtDay } from './plan-ui';

/**
 * Race countdown + phase ribbon — where you are in the Runna block at a glance.
 */
export default function RaceCountdown({ plan }: { plan: PlanPayload }) {
  const today = plan.today;
  const daysLeft = daysBetween(today, plan.race.date);
  const week = plan.weeks.find((w) => today >= w.start && today <= w.end) ?? plan.weeks.find((w) => w.start > today) ?? null;
  const phase = PHASES.find((p) => today >= p.start && today <= p.end);
  const next = plan.runs.find((r) => r.date >= today && r.status !== 'skipped' && !(r.date === today && r.actual));
  const total = daysBetween(PHASES[0].start, plan.race.date) + 1;
  const pos = Math.max(0, Math.min(100, (daysBetween(PHASES[0].start, today) / (total - 1)) * 100));

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Miami marathon" value={`${daysLeft} days`} sub={`${fmtDay(plan.race.date, { weekday: 'short', month: 'short', day: 'numeric' })} · goal sub-4`} />
        <Tile label="Plan position" value={week ? `Week ${week.week} of 23` : '—'} sub={phase ? phase.label : ''} color={phase ? PHASE_COLOR[phase.key] : undefined} />
        <Tile label="This week" value={week ? `${week.actualKm} / ${week.plannedKm} km` : '—'} sub="run km so far / planned" />
        <Tile label="Next run" value={next ? `${next.plannedDistanceKm} km` : '—'}
          sub={next ? `${fmtDay(next.date)} · ${next.workoutName}` : 'Plan complete'} />
      </div>

      <div>
        <div className="relative flex gap-[3px]">
          {PHASES.map((p, i) => {
            const days = daysBetween(p.start, p.end) + 1;
            return (
              <div key={i} className="flex flex-col items-center justify-center rounded px-1 py-1.5 text-center text-[10px] leading-tight"
                style={{ flex: days, background: `${PHASE_COLOR[p.key]}26`, color: PHASE_COLOR[p.key] }} title={`${p.label}: ${p.start} → ${p.end}`}>
                <span className="font-semibold">{p.label}</span>
              </div>
            );
          })}
          <div className="pointer-events-none absolute -top-1 bottom-[-4px] w-0.5 rounded bg-gray-12" style={{ left: `${pos}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-gray-10">
          <span>{fmtDay(PHASES[0].start, { month: 'short', day: 'numeric' })}</span>
          <span className="flex items-center gap-1"><CalendarClock size={11} /> today · {fmtDay(today, { month: 'short', day: 'numeric' })}</span>
          <span>Race · {fmtDay(plan.race.date, { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
      {week?.note && <p className="text-xs text-gray-10"><span className="font-medium text-gray-11">Week {week.week}:</span> {week.note}</p>}
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-3">
      <span className="text-[10px] uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-xl font-semibold text-gray-12" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="truncate text-[10px] text-gray-10">{sub}</span>}
    </div>
  );
}
