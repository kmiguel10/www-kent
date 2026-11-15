import type { DailyMatrix, MetricKey } from '@/lib/athlete-os/types';
import { capMode, scheduledOn } from './schedule';
import type { StrengthMode } from './types';

/**
 * Readiness rules — MARATHON_TRAINING.md §13, using WHOOP + Garmin only.
 *
 * Multi-signal (never WHOOP recovery alone): recovery, HRV and RHR relative to
 * the athlete's own 30-day baseline, 3-night sleep debt, yesterday's strain.
 * Advice follows the athlete's fatigue ladder — cut optional cycling first,
 * then accessories, then lower-body strength, then modify the run, then rest —
 * protects key runs, and never stacks missed sessions.
 *
 * The athlete chose not to log check-ins, so alcohol, soreness and illness are
 * invisible here; every recommendation says so.
 */

export type Flag = 'green' | 'amber' | 'red' | 'unknown';

export interface Signal { key: string; label: string; value: string; status: 'ok' | 'watch' | 'concern' | 'none'; detail: string }

export interface DayPlanItem { kind: 'run' | 'strength' | 'plyo' | 'cycling' | 'rest'; label: string; advice: string; protected?: boolean }

export interface Readiness {
  date: string;
  flag: Flag;
  headline: string;
  signals: Signal[];
  items: DayPlanItem[];
  caveat: string;
}

const MODE_TEXT: Record<StrengthMode, string> = {
  normal: 'full session',
  moderate: 'moderate volume',
  reduced: 'reduced version (2 sets, RPE 6–7)',
  maintenance: '1–2 sets of the main lifts, no failure',
  minimal: 'minimal — skip it if it would cost the next run',
  none: 'skip',
};

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };

function valueOn(m: DailyMatrix, key: MetricKey, date: string): number | null {
  const i = m.dates.indexOf(date);
  return i >= 0 ? m.series[key]?.[i] ?? null : null;
}

function baseline(m: DailyMatrix, key: MetricKey, date: string, days = 30): number | null {
  const vals: number[] = [];
  for (let k = 1; k <= days; k++) { const v = valueOn(m, key, addDays(date, -k)); if (v != null) vals.push(v); }
  return vals.length >= 7 ? median(vals) : null;
}

export function assessReadiness(m: DailyMatrix, date: string): Readiness {
  const recovery = valueOn(m, 'recovery', date);
  const hrv = valueOn(m, 'hrv', date), hrvBase = baseline(m, 'hrv', date);
  const rhr = valueOn(m, 'restingHr', date), rhrBase = baseline(m, 'restingHr', date);
  const debt3 = valueOn(m, 'sleepDebt3d', date);
  const strainY = valueOn(m, 'strain', addDays(date, -1));

  const hrvDelta = hrv != null && hrvBase ? (hrv / hrvBase - 1) * 100 : null;
  const rhrDelta = rhr != null && rhrBase != null ? rhr - rhrBase : null;

  const signals: Signal[] = [
    { key: 'recovery', label: 'WHOOP recovery', value: recovery != null ? `${Math.round(recovery)}%` : '—',
      status: recovery == null ? 'none' : recovery < 34 ? 'concern' : recovery < 67 ? 'watch' : 'ok', detail: 'WHOOP red < 34, yellow 34–66' },
    { key: 'hrv', label: 'HRV vs baseline', value: hrvDelta != null ? `${hrvDelta >= 0 ? '+' : ''}${Math.round(hrvDelta)}%` : '—',
      status: hrvDelta == null ? 'none' : hrvDelta <= -20 ? 'concern' : hrvDelta <= -10 ? 'watch' : 'ok',
      detail: hrv != null && hrvBase ? `${Math.round(hrv)} ms vs ${Math.round(hrvBase)} ms 30-day median` : 'needs 7+ days' },
    { key: 'rhr', label: 'Resting HR vs baseline', value: rhrDelta != null ? `${rhrDelta >= 0 ? '+' : ''}${Math.round(rhrDelta)} bpm` : '—',
      status: rhrDelta == null ? 'none' : rhrDelta >= 5 ? 'concern' : rhrDelta >= 3 ? 'watch' : 'ok',
      detail: rhr != null && rhrBase != null ? `${Math.round(rhr)} vs ${Math.round(rhrBase)} bpm 30-day median` : 'needs 7+ days' },
    { key: 'debt', label: '3-night sleep debt', value: debt3 != null ? `${Math.round(debt3 / 60 * 10) / 10} h` : '—',
      status: debt3 == null ? 'none' : debt3 >= 180 ? 'concern' : debt3 >= 120 ? 'watch' : 'ok', detail: 'need minus obtained, last 3 nights' },
    { key: 'strain', label: "Yesterday's strain", value: strainY != null ? strainY.toFixed(1) : '—',
      status: strainY == null ? 'none' : strainY >= 18 ? 'concern' : strainY >= 16 ? 'watch' : 'ok', detail: 'WHOOP day strain (0–21)' },
  ];

  let flag: Flag;
  if (recovery == null) flag = 'unknown';
  else if (recovery < 34 || (hrvDelta != null && hrvDelta <= -20 && rhrDelta != null && rhrDelta >= 5)) flag = 'red';
  else if (signals.some((s) => s.status === 'concern' || s.status === 'watch')) flag = 'amber';
  else flag = 'green';
  const f = flag === 'unknown' ? 'amber' : flag; // no WHOOP yet → treat cautiously

  // ── What's on today (shared schedule) → readiness-adjusted advice ──────
  const sch = scheduledOn(date);
  const run = sch.run;
  const items: DayPlanItem[] = [];

  if (run) {
    const t = run.workoutType;
    const advice = run.explicitStatus === 'skipped' ? 'Skipped by choice — don’t make it up; the next sessions stand.'
      : t === 'race' ? 'Race day.'
      : t === 'quality' ? (f === 'green' ? 'Run it as prescribed.'
        : f === 'amber' ? 'Run it, but let the warm-up decide: if effort or HR runs well above normal, finish it as an easy run of the same distance. Don’t make up the reps later.'
        : 'Swap for an easy run or rest. Don’t reschedule or stack it — the next sessions stand.')
      : t === 'long' ? (f === 'green' ? 'Run it as prescribed and practice fueling (40–60 g carbs/hour).'
        : f === 'amber' ? 'Run it with the easy parts truly easy; trimming up to ~20% is fine if it feels off.'
        : 'Shorten it substantially or rest. Don’t stack the missed distance onto later days.')
      : (f === 'green' ? 'As planned, conversational effort.' : f === 'amber' ? 'Shorten it or keep it very easy.' : 'Rest, or a 20–30 min Zone 1 spin if you want to move.');
    items.push({ kind: 'run', label: `${run.workoutName} · ${run.plannedDistanceKm} km`, advice, protected: run.priority === 'protected' });
  }

  if (sch.plyo) {
    items.push({ kind: 'plyo', label: 'Plyometrics (~10 min)', advice: f === 'green' ? 'OK while fresh — stop when jump quality drops.' : 'Skip today — only when well recovered.' });
  }

  if (sch.strength) {
    const isLower = sch.strength.key === 'lower';
    let mode: StrengthMode = sch.strength.mode;
    if (f === 'amber') mode = capMode(mode, 'reduced');
    if (f === 'red') mode = capMode(mode, isLower ? 'none' : 'maintenance');
    const why = sch.strength.reason ? ` — ${sch.strength.reason}` : '';
    const extra = sch.strength.key === 'upperB' ? ' No meaningful leg work before Saturday.' : '';
    items.push({ kind: 'strength', label: sch.strength.label, advice: `${MODE_TEXT[mode][0].toUpperCase()}${MODE_TEXT[mode].slice(1)}${why}.${extra}` });
  }

  if (sch.cyclingOptional) {
    const ok = f === 'green' && sch.cyclingOptional.allowed;
    items.push({ kind: 'cycling', label: sch.rest ? 'Optional easy Z2 ride' : 'Optional short Z2 ride',
      advice: ok ? `Fine if you feel good — conversational, 45–75 min max (${sch.cyclingOptional.label}).` : 'Skip it — optional rides are the first thing to cut.' });
  }
  if (sch.rest) items.push({ kind: 'rest', label: 'Rest day', advice: 'Complete rest is the default.' });

  const headline = flag === 'unknown' ? 'No WHOOP recovery yet today — defaulting to caution.'
    : flag === 'green' ? 'Good to train as planned.'
    : flag === 'amber' ? 'Train, but trim the optional stuff first.'
    : 'Recovery is clearly low — protect the plan by backing off today.';

  return {
    date, flag, headline, signals, items,
    caveat: 'Based on WHOOP and Garmin only — it can’t see alcohol, soreness or illness. If any apply, take the easier option; with fever, body aches or chest symptoms, skip hard exercise. WHOOP recovery alone is not a permission system.',
  };
}
