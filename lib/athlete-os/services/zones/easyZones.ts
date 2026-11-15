import { ZONES } from '@/lib/athlete-os/plan/miami2027';

/**
 * Easy / grey / hard seconds from Garmin's 5 HR-zone bins.
 *
 * Runs use the athlete's own easy ceiling (≤151 bpm, MARATHON_TRAINING.md)
 * rather than Garmin's LT-based Z2 (tops out at 140). Garmin summaries only
 * give time per Garmin zone, and 151 sits inside Garmin Z3 (141–164), so that
 * zone is split in proportion to its bpm span — an estimate until per-second
 * HR is available. Hard = at/above lactate threshold (Garmin Z4–5).
 *
 * Rides (and anything else) keep Garmin's own zones: easy Z1–2, grey Z3, hard Z4–5.
 */
export interface EasySplit { easy: number; grey: number; hard: number }

export function easyGreyHard(zoneSecs: number[], isRun: boolean): EasySplit {
  const z = [0, 1, 2, 3, 4].map((i) => Number(zoneSecs[i]) || 0);
  if (!isRun) return { easy: z[0] + z[1], grey: z[2], hard: z[3] + z[4] };

  const floors = ZONES.runZoneFloors;
  const ceil = ZONES.runEasyMaxHr;
  const out: EasySplit = { easy: 0, grey: 0, hard: 0 };
  for (let k = 0; k < 5; k++) {
    if (k >= 3) { out.hard += z[k]; continue; } // Z4–5: at/above threshold
    const lo = floors[k];
    const hiExcl = floors[k + 1];
    const easyFrac = Math.max(0, Math.min(1, (ceil - lo + 1) / (hiExcl - lo)));
    out.easy += z[k] * easyFrac;
    out.grey += z[k] * (1 - easyFrac);
  }
  return out;
}

export const EASY_LABEL_RUN = `≤${ZONES.runEasyMaxHr} bpm`;
