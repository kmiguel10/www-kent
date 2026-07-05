import {
  type AerobicModel, type Confidence, type Recommendation,
  formatPace,
} from './aerobicAnalysis';

/**
 * Running aerobic analysis — the pace-based analog of the cycling engine.
 * Runners have no power/FTP, so the intensity axis is SPEED (m/s) and the
 * anchor is a data-derived threshold pace. Same cross-ride method and honest
 * limits as cycling (no per-second streams → moderate confidence).
 */

export interface RunSummary {
  date: string;
  name: string;
  treadmill: boolean;
  durationSeconds: number;
  distanceMeters: number | null;
  avgHr: number | null;
  maxHr: number | null;
  paceSecPerKm: number | null;
  hrZoneSecs: number[];
}

const speedOf = (r: RunSummary) => (r.paceSecPerKm ? 1000 / r.paceSecPerKm : null);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** HR = a + b·speed(m/s) across runs. */
function hrSpeedFit(runs: RunSummary[]): { a: number; b: number; n: number } | null {
  const pts = runs.map((r) => ({ x: speedOf(r), y: r.avgHr })).filter((p): p is { x: number; y: number } => !!p.x && !!p.y);
  const n = pts.length;
  if (n < 8) return null;
  const sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0);
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0), sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const b = (n * sxy - sx * sy) / denom;
  return { a: (sy - b * sx) / n, b, n };
}

/** Threshold pace ≈ fast robust percentile of pace on sustained (20–75 min) runs. */
function estimateThresholdPace(runs: RunSummary[]): number | null {
  const paces = runs
    .filter((r) => r.paceSecPerKm && r.durationSeconds >= 1200 && r.durationSeconds <= 4500)
    .map((r) => r.paceSecPerKm!)
    .sort((a, b) => a - b); // ascending = fast → slow
  if (paces.length < 3) {
    const any = runs.map((r) => r.paceSecPerKm).filter((v): v is number => !!v).sort((a, b) => a - b);
    return any.length ? any[Math.floor(any.length * 0.05)] : null;
  }
  return paces[Math.floor(paces.length * 0.05)]; // 5th-percentile fastest sustained pace
}

const isEasyName = (n: string) => /easy|recovery|long|base|shakeout|z2|zone ?2|aerobic|endur/i.test(n);
const ZONE_LABEL = ['—', 'Z1 Recovery', 'Z2 Aerobic', 'Z3 Tempo', 'Z4 Threshold', 'Z5 VO₂'];

export function buildRunningModel(runs: RunSummary[]): AerobicModel | null {
  // Guard against GPS/HR glitches: plausible HR 50–220 bpm, pace 2:30–20:00/km.
  const withHrPace = runs.filter(
    (r) => r.avgHr && r.avgHr >= 50 && r.avgHr <= 220 && r.paceSecPerKm && r.paceSecPerKm >= 150 && r.paceSecPerKm <= 1200,
  );
  const fit = hrSpeedFit(withHrPace);
  const thrPace = estimateThresholdPace(withHrPace);
  if (!fit || !thrPace) return null;

  const thrSpeed = 1000 / thrPace;
  const hrAt = (spd: number) => Math.round(fit.a + fit.b * spd);

  // Zone speed anchors as fraction of threshold speed (running zones are tight).
  const anchors: [string, number, number][] = [
    ['Z1 · Recovery', 0, 0.75],
    ['Z2 · Aerobic', 0.75, 0.84],
    ['Z3 · Tempo', 0.84, 0.91],
    ['Z4 · Threshold', 0.91, 1.0],
    ['Z5 · VO₂', 1.0, 1.3],
  ];
  const zoneRows = anchors.map(([zone, lo, hi], i) => {
    const sLo = lo * thrSpeed, sHi = hi * thrSpeed;
    const hr = i === 0 ? `< ${hrAt(sHi)} bpm` : i === anchors.length - 1 ? `${hrAt(sLo)}+ bpm` : `${hrAt(sLo)}–${hrAt(sHi)} bpm`;
    // pace band: faster (hi speed) → slower (lo speed)
    const pace = i === 0 ? `slower than ${formatPace(1000 / sHi)}` : i === anchors.length - 1 ? `faster than ${formatPace(1000 / sLo)}` : `${formatPace(1000 / sHi)}–${formatPace(1000 / sLo)} /km`;
    return { zone, hr, intensity: pace };
  });

  const z2 = anchors[1];
  const z2SpeedLo = z2[1] * thrSpeed, z2SpeedHi = z2[2] * thrSpeed;
  const z2HrLow = hrAt(z2SpeedLo), z2HrHigh = hrAt(z2SpeedHi);

  // Efficiency (speed/HR) trend.
  const efPts = withHrPace.map((r) => ({ date: r.date, ef: speedOf(r)! / r.avgHr! }));
  const third = Math.floor(efPts.length / 3) || 1;
  const early = mean(efPts.slice(0, third).map((p) => p.ef));
  const recent = mean(efPts.slice(-third).map((p) => p.ef));
  const efChangePct = early > 0 ? (recent / early - 1) * 100 : 0;

  // Second trend: sustained speed (fitness proxy, higher = fitter).
  const sustained = withHrPace
    .filter((r) => r.durationSeconds >= 1200 && r.durationSeconds <= 4500)
    .map((r) => ({ date: r.date, v: +(speedOf(r)!.toFixed(2)) }));

  // Easy-run audit.
  const audit = withHrPace
    .filter((r) => r.hrZoneSecs.reduce((a, b) => a + b, 0) > 0)
    .map((r) => {
      const z = r.hrZoneSecs, tot = z.reduce((a, b) => a + b, 0) || 1;
      const easyPct = Math.round(((z[0] + z[1]) / tot) * 100);
      const dom = z.indexOf(Math.max(...z)) + 1;
      const isLong = r.durationSeconds >= 4500;
      const intended: 'easy' | 'other' = isEasyName(r.name) || isLong ? 'easy' : 'other';
      return {
        date: r.date, name: r.name, intended,
        avgHr: r.avgHr, maxHr: r.maxHr,
        intensity: `${formatPace(r.paceSecPerKm!)}/km`,
        easyPct, abovePct: 100 - easyPct, actualZone: ZONE_LABEL[dom] ?? '—',
        flagged: intended === 'easy' && 100 - easyPct > 50,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // Indoor(treadmill) vs outdoor.
  const tread = withHrPace.filter((r) => r.treadmill);
  const out = withHrPace.filter((r) => !r.treadmill);
  const hrGap = tread.length >= 3 && out.length >= 3 ? Math.round(mean(tread.map((r) => r.avgHr!)) - mean(out.map((r) => r.avgHr!))) : null;

  const confidence: Confidence = fit.n >= 40 ? 'moderate' : 'low';

  const recs: Recommendation[] = [];
  recs.push({
    severity: 'action',
    title: `Your true running Zone 2 is likely ${z2HrLow}–${z2HrHigh} bpm (${formatPace(1000 / z2SpeedHi)}–${formatPace(1000 / z2SpeedLo)} /km)`,
    detail: `Derived from a ${fit.n}-run HR–pace regression anchored on your ${formatPace(thrPace)}/km threshold pace. Keep easy runs at or below ~${z2HrHigh} bpm.`,
  });
  const flagged = audit.filter((a) => a.flagged);
  if (flagged.length) {
    recs.push({
      severity: 'action',
      title: `${flagged.length} "easy" run${flagged.length > 1 ? 's' : ''} ran above aerobic threshold`,
      detail: `e.g. "${flagged[0].name}" spent ${flagged[0].abovePct}% of time above Zone 2 (dominant ${flagged[0].actualZone}). Slow down until HR settles under ${z2HrHigh}.`,
    });
  }
  if (efPts.length >= 6) {
    recs.push({
      severity: efChangePct >= 0 ? 'good' : 'info',
      title: `Aerobic efficiency ${efChangePct >= 0 ? 'improved' : 'declined'} ${Math.abs(Math.round(efChangePct))}%`,
      detail: `Speed per heartbeat moved ${early.toFixed(4)} → ${recent.toFixed(4)} m·s⁻¹/bpm across your history.`,
    });
  }
  if (hrGap != null && hrGap >= 4) {
    recs.push({
      severity: 'info',
      title: `Treadmill runs average ~${hrGap} bpm hotter than outdoor`,
      detail: `Indoor heat inflates HR — expect a higher HR for the same pace on the treadmill, and add cooling for true easy runs.`,
    });
  }

  return {
    sport: 'running',
    anchorLabel: 'Threshold pace',
    anchorValue: `${formatPace(thrPace)} /km`,
    anchorSub: 'fastest sustained effort',
    z2HrText: `${z2HrLow}–${z2HrHigh} bpm`,
    z2IntensityText: `${formatPace(1000 / z2SpeedHi)}–${formatPace(1000 / z2SpeedLo)} /km`,
    thresholdHr: hrAt(thrSpeed),
    confidence,
    sampleN: fit.n,
    xLabel: 'Speed (m/s)',
    scatter: withHrPace.map((r) => ({ x: speedOf(r)!, y: r.avgHr! })),
    fit: { a: fit.a, b: fit.b },
    fitLabel: `HR ≈ ${Math.round(fit.a)} + ${fit.b.toFixed(1)}·(m/s)`,
    z2BandX: [z2SpeedLo, z2SpeedHi],
    z2CeilingHr: z2HrHigh,
    formatX: (x) => `${formatPace(1000 / x)}/km`,
    zoneRows,
    efChangePct,
    efPts: efPts.map((p) => ({ date: p.date, v: +p.ef.toFixed(4) })),
    secondTrend: { label: 'Sustained speed (m/s)', unit: '', pts: sustained },
    auditTitle: 'Easy-run audit · is your "easy" actually easy?',
    auditIntensityLabel: 'Pace',
    audit,
    recs,
  };
}
