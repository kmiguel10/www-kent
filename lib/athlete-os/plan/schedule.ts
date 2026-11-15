import { PHASES, PLAN_RUNS, STRENGTH_LABEL, WEEKLY_TEMPLATE, phaseOn } from './miami2027';
import type { Phase, PlannedRun, StrengthMode } from './types';

/**
 * What's scheduled on a date (before any readiness adjustment): the Runna run,
 * the strength session from the weekly template at the phase's intensity, plyos,
 * optional cycling, rest. Shared by the week board and the readiness coach so
 * the two never disagree.
 */

export const MODE_ORDER: StrengthMode[] = ['none', 'minimal', 'maintenance', 'reduced', 'moderate', 'normal'];
export const capMode = (m: StrengthMode, cap: StrengthMode) => (MODE_ORDER.indexOf(m) > MODE_ORDER.indexOf(cap) ? cap : m);
export const MODE_SHORT: Record<StrengthMode, string> = {
  normal: 'full', moderate: 'moderate', reduced: 'reduced', maintenance: 'maintenance', minimal: 'minimal', none: 'skip',
};

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export interface Scheduled {
  date: string;
  phase: Phase;
  run: PlannedRun | null;
  strength: { key: 'upperA' | 'lower' | 'upperB'; label: string; mode: StrengthMode; reason: string | null } | null;
  plyo: boolean;
  cyclingOptional: { allowed: boolean; label: string } | null;
  rest: boolean;
}

export function scheduledOn(date: string): Scheduled {
  const phase = phaseOn(date) ?? PHASES[0];
  const tpl = WEEKLY_TEMPLATE[new Date(date + 'T00:00:00Z').getUTCDay()];
  const run = PLAN_RUNS.find((r) => r.date === date) ?? null;

  let strength: Scheduled['strength'] = null;
  if (tpl?.strength) {
    const isLower = tpl.strength === 'lower';
    let mode: StrengthMode = isLower ? phase.strength.lower : phase.strength.upper;
    let reason: string | null = null;
    if (isLower) {
      // Rule 4: reduce Wednesday legs when Saturday's long run is especially demanding.
      const nextLong = PLAN_RUNS.find((r) => r.workoutType === 'long' && r.date > date && r.date <= addDays(date, 4));
      if (nextLong && nextLong.plannedDistanceKm >= 24 && MODE_ORDER.indexOf(mode) > MODE_ORDER.indexOf('reduced')) {
        mode = 'reduced';
        reason = `${nextLong.plannedDistanceKm} km long run ahead`;
      }
    }
    if (phase.key === 'race') mode = capMode(mode, isLower ? 'none' : 'minimal');
    strength = { key: tpl.strength, label: STRENGTH_LABEL[tpl.strength], mode, reason };
  }

  const cyclingOptional = tpl?.cyclingOptional
    ? { allowed: !['peak', 'race', 'lateTaper'].includes(phase.key), label: phase.cycling }
    : null;

  return { date, phase, run, strength, plyo: !!tpl?.plyo && phase.strength.plyo, cyclingOptional, rest: !!tpl?.rest && !run };
}
