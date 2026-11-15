import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Footprints, Dumbbell, Bike, Moon, Zap, ShieldCheck, RefreshCw } from 'lucide-react';

import type { PlanPayload } from '@/pages/api/athlete-os/plan';
import { scheduledOn, MODE_SHORT } from '@/lib/athlete-os/plan/schedule';
import { PHASE_COLOR, StatusChip, addDays, fmtDay, fmtPaceS } from './plan-ui';

/**
 * Week board — the whole training week (Runna run, strength at phase-appropriate
 * intensity, optional cycling, rest) with plan-vs-actual status. Strength is
 * shown as a plan only (not tracked, by the athlete's choice); rides come from Garmin.
 */
export default function WeekBoard({ plan }: { plan: PlanPayload }) {
  const initial = Math.max(0, plan.weeks.findIndex((w) => plan.today >= w.start && plan.today <= w.end));
  const [idx, setIdx] = useState(initial);
  const week = plan.weeks[idx];
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week.start, i)), [week.start]);

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button aria-label="Previous week" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
            className="rounded-md border border-gray-6 p-1 text-gray-11 hover:bg-gray-3 disabled:opacity-40"><ChevronLeft size={14} /></button>
          <span className="text-sm font-semibold text-gray-12">Week {week.week}</span>
          <span className="text-xs text-gray-10">{fmtDay(week.start, { month: 'short', day: 'numeric' })} – {fmtDay(week.end, { month: 'short', day: 'numeric' })}</span>
          <button aria-label="Next week" onClick={() => setIdx((i) => Math.min(plan.weeks.length - 1, i + 1))} disabled={idx === plan.weeks.length - 1}
            className="rounded-md border border-gray-6 p-1 text-gray-11 hover:bg-gray-3 disabled:opacity-40"><ChevronRight size={14} /></button>
          {idx !== initial && <button onClick={() => setIdx(initial)} className="text-[11px] text-teal-400 hover:underline">this week</button>}
        </div>
        <span className="text-xs text-gray-11">
          <span className="font-medium text-gray-12">{week.actualKm}</span> / {week.plannedKm} km run
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map((d) => {
          const s = scheduledOn(d);
          const view = plan.runs.find((r) => r.date === d);
          const rides = week.rides.filter((r) => r.date === d);
          const isToday = d === plan.today;
          const protectedRun = view && view.priority === 'protected';
          return (
            <div key={d}
              className={clsx('flex flex-col gap-1.5 rounded-xl border bg-gray-2 p-2.5 text-xs sm:min-h-[132px]',
                isToday ? 'border-teal-600' : protectedRun ? 'border-violet-800' : 'border-gray-6',
                d < plan.today && !isToday && 'opacity-80')}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-12">{fmtDay(d, { weekday: 'short' })}</span>
                <span className="text-[10px] text-gray-10">{fmtDay(d, { month: 'numeric', day: 'numeric' })}</span>
              </div>

              {view && (
                <div className="flex flex-col gap-1">
                  <span className="flex items-start gap-1 font-medium text-gray-12"><Footprints size={12} className="mt-0.5 shrink-0" style={{ color: PHASE_COLOR[s.phase.key] }} />{view.workoutName}</span>
                  <span className="text-gray-10">{view.plannedDistanceKm} km planned{view.actual ? ` · ${view.actual.km.toFixed(1)} km done` : ''}</span>
                  {view.actual && <span className="text-[10px] text-gray-10">{fmtPaceS(view.actual.paceSecPerKm)}/km{view.actual.avgHr ? ` · ${Math.round(view.actual.avgHr)} bpm` : ''}</span>}
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusChip status={view.status} />
                    {protectedRun && <ShieldCheck size={11} className="text-violet-400" aria-label="protected" />}
                  </div>
                  {view.runnaChange && <span className="flex items-center gap-1 text-[10px] text-sky-400"><RefreshCw size={10} />{view.runnaChange}</span>}
                </div>
              )}

              {s.plyo && <span className="flex items-center gap-1 text-gray-11"><Zap size={11} />Plyos (if fresh)</span>}
              {s.strength && (
                <span className="flex flex-wrap items-center gap-1 text-gray-11">
                  <Dumbbell size={11} />{s.strength.label}
                  <span className={clsx('rounded px-1 text-[10px]', s.strength.mode === 'none' ? 'bg-gray-4 text-gray-10' : 'bg-gray-3 text-gray-11')}>{MODE_SHORT[s.strength.mode]}</span>
                </span>
              )}
              {s.strength?.reason && <span className="text-[10px] text-gray-10">{s.strength.reason}</span>}

              {rides.map((r, i) => (
                <span key={i} className="flex items-center gap-1 text-sky-400"><Bike size={11} />{r.minutes} min ride</span>
              ))}
              {!rides.length && s.cyclingOptional?.allowed && <span className="flex items-center gap-1 text-gray-10"><Bike size={11} />optional Z2</span>}
              {s.rest && !rides.length && <span className="flex items-center gap-1 text-gray-10"><Moon size={11} />Rest</span>}
            </div>
          );
        })}
      </div>

      {week.note && <p className="text-xs text-gray-10">{week.note}</p>}
      <p className="text-[10px] text-gray-10">
        Runs: Runna plan vs Garmin. Strength: the scheduled session at this phase's intensity (not tracked). Rides: recorded on Garmin.
        {!plan.runnaCalendarConnected && ' Runna’s live changes appear once the calendar sync is enabled.'}
      </p>
    </div>
  );
}
