import { useMemo } from 'react';
import clsx from 'clsx';
import { Footprints, Dumbbell, Bike, Moon, Zap, ShieldCheck, Info } from 'lucide-react';

import type { DailyMatrix } from '@/lib/athlete-os/types';
import { assessReadiness, type DayPlanItem, type Flag } from '@/lib/athlete-os/plan/readiness';
import { computeDrivers, tercileOf } from '@/lib/athlete-os/services/performance/drivers';

/**
 * Today — readiness-aware coaching (MARATHON_TRAINING.md §13). Flags the day
 * from WHOOP + Garmin signals, then adjusts each scheduled item using the
 * athlete's fatigue ladder. Adds the personal context from the drivers engine.
 */

const FLAG = {
  green: { label: 'Good to go', cls: 'border-emerald-800 text-emerald-400', dot: '#10b981' },
  amber: { label: 'Trim the extras', cls: 'border-amber-800 text-amber-400', dot: '#eab308' },
  red: { label: 'Back off today', cls: 'border-red-900 text-red-400', dot: '#ef4444' },
  unknown: { label: 'Waiting on WHOOP', cls: 'border-gray-6 text-gray-10', dot: '#64748b' },
} satisfies Record<Flag, { label: string; cls: string; dot: string }>;

const SIGNAL_DOT = { ok: '#10b981', watch: '#eab308', concern: '#ef4444', none: '#475569' } as const;
const ICON: Record<DayPlanItem['kind'], typeof Footprints> = { run: Footprints, strength: Dumbbell, plyo: Zap, cycling: Bike, rest: Moon };

export default function ReadinessCoach({ matrix, today }: { matrix: DailyMatrix; today: string }) {
  const r = useMemo(() => assessReadiness(matrix, today), [matrix, today]);
  const personal = useMemo(() => {
    const e = computeDrivers(matrix, ['runPerf'], ['recovery'])[0];
    const i = matrix.dates.indexOf(today);
    const v = i >= 0 ? matrix.series.recovery[i] : null;
    if (!e || v == null || e.confidence === 'low') return null;
    const band = tercileOf(e, v);
    const exp = band === 'high' ? e.highMean : band === 'low' ? e.lowMean : (e.lowMean + e.highMean) / 2;
    return { band, exp };
  }, [matrix, today]);
  const fs = FLAG[r.flag];

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ background: fs.dot }} />
          <span className="text-lg font-semibold text-gray-12">{r.headline}</span>
        </div>
        <span className={clsx('rounded-full border px-3 py-1 text-xs font-medium', fs.cls)}>{fs.label}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {r.signals.map((s) => (
          <span key={s.key} title={s.detail} className="flex items-center gap-1.5 rounded-full border border-gray-6 bg-gray-2 px-2.5 py-1 text-[11px] text-gray-11">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SIGNAL_DOT[s.status] }} />
            {s.label} <span className="font-medium text-gray-12">{s.value}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {r.items.length === 0 && <p className="text-sm text-gray-10">Nothing scheduled today.</p>}
        {r.items.map((it, i) => {
          const Icon = ICON[it.kind];
          return (
            <div key={i} className="flex gap-3 rounded-xl border border-gray-6 bg-gray-2 p-3">
              <Icon size={16} className="mt-0.5 shrink-0 text-gray-11" />
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-12">
                  {it.label}
                  {it.protected && <span className="flex items-center gap-1 text-[10px] font-normal text-violet-400"><ShieldCheck size={11} />protected</span>}
                </span>
                <span className="text-sm text-gray-11">{it.advice}</span>
              </div>
            </div>
          );
        })}
      </div>

      {personal && (
        <p className="text-xs text-gray-11">
          <span className="font-medium text-gray-12">Your pattern:</span> on {personal.band === 'mid' ? 'middle' : personal.band === 'high' ? 'top' : 'bottom'}-third
          recovery days your runs average <span className="font-medium" style={{ color: personal.exp >= 0 ? '#10b981' : '#f97316' }}>{personal.exp >= 0 ? '+' : ''}{personal.exp.toFixed(1)}%</span> vs your usual for the effort.
        </p>
      )}
      <p className="flex gap-1.5 text-[11px] text-gray-10"><Info size={12} className="mt-0.5 shrink-0" />{r.caveat}</p>
    </div>
  );
}
