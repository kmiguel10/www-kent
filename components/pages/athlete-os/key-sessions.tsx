import { useState } from 'react';
import clsx from 'clsx';

import type { PlanPayload } from '@/pages/api/athlete-os/plan';
import { fmtDay, fmtPaceS } from './plan-ui';

/**
 * Key-session scorecard — every Runna quality session and long run recorded on
 * Garmin (matched by Runna's workout name, so history goes back to the start of
 * the plan). Target paces aren't in the plan data yet, so this shows completion,
 * pace, HR and that morning's WHOOP recovery — no invented targets.
 */
export default function KeySessions({ plan }: { plan: PlanPayload }) {
  const [type, setType] = useState<'all' | 'quality' | 'long'>('all');
  const rows = plan.keySessions.filter((s) => type === 'all' || s.type === type);
  const withPlan = rows.filter((s) => s.plannedKm);
  const fullDistance = withPlan.filter((s) => s.actualKm >= 0.9 * s.plannedKm!).length;
  const recov = (t: 'quality' | 'long', hi: boolean) => {
    const xs = plan.keySessions.filter((s) => s.type === t && s.plannedKm && s.morningRecovery != null && (hi ? s.morningRecovery >= 67 : s.morningRecovery < 67));
    return xs.length ? { n: xs.length, rate: xs.filter((s) => s.actualKm >= 0.9 * s.plannedKm!).length / xs.length } : null;
  };
  const longHi = recov('long', true), longLo = recov('long', false);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-6">
          {(['all', 'quality', 'long'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={clsx('px-3 py-1.5 text-xs font-semibold capitalize transition-colors', type === t ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3')}>
              {t === 'all' ? 'All' : t === 'quality' ? 'Quality' : 'Long runs'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-11">
          Full distance (≥90%): <span className="font-medium text-gray-12">{fullDistance}/{withPlan.length}</span> sessions
        </span>
      </div>

      {longHi && longLo && (
        <p className="text-xs text-gray-11">
          Long runs went the full distance <span className="font-medium text-gray-12">{Math.round(longHi.rate * 100)}%</span> of the time on green-recovery mornings (n={longHi.n})
          vs <span className="font-medium text-gray-12">{Math.round(longLo.rate * 100)}%</span> below 67% (n={longLo.n}). Small samples — directional only.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-6">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-gray-2 text-gray-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Runna session</th>
              <th className="px-3 py-2 text-right font-medium">Distance</th>
              <th className="px-3 py-2 text-right font-medium">Pace</th>
              <th className="px-3 py-2 text-right font-medium">Avg HR</th>
              <th className="px-3 py-2 text-right font-medium">Target pace</th>
              <th className="px-3 py-2 text-right font-medium">WHOOP</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((s, i) => {
              const short = s.plannedKm != null && s.actualKm < 0.9 * s.plannedKm;
              return (
                <tr key={i} className="border-t border-gray-6">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-11">{fmtDay(s.date, { month: 'short', day: 'numeric' })}</td>
                  <td className="px-3 py-2 text-gray-12">{s.name}</td>
                  <td className={clsx('whitespace-nowrap px-3 py-2 text-right tabular-nums', short ? 'text-amber-400' : 'text-gray-11')}>
                    {s.actualKm.toFixed(1)}{s.plannedKm != null ? ` / ${s.plannedKm}` : ''} km
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">{fmtPaceS(s.paceSecPerKm)}/km</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">{s.avgHr ? Math.round(s.avgHr) : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-9">not provided</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: s.morningRecovery == null ? 'var(--gray-10)' : s.morningRecovery >= 67 ? '#10b981' : s.morningRecovery >= 34 ? '#eab308' : '#ef4444' }}>
                    {s.morningRecovery != null ? `${Math.round(s.morningRecovery)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-10">
        Matched from Runna workout names on your Garmin runs; planned distance read from the name. Target paces and interval structure aren’t in the plan yet — add them and this becomes a target-hit scorecard.
      </p>
    </div>
  );
}
