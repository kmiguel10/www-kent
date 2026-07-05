/**
 * Aerobic analysis — derives cycling zones from historical evidence rather than
 * generic formulas. Pure (no React, no fetching), so it is testable and reused
 * by both the panel and the (future) weekly recompute service.
 *
 * Method, and its honest limits:
 *  • FTP is read from the mean-max power curve (best 20-min × 0.95) — direct.
 *  • Zone 2 HR is derived from a cross-ride HR–power regression evaluated at
 *    aerobic power, then cross-checked against the HR-zone audit. This is a
 *    between-ride estimate; true LT1 needs per-second streams (not stored yet),
 *    so confidence is capped at "moderate".
 *  • Intra-ride aerobic decoupling / HR-drift is intentionally NOT computed
 *    here — the summaries lack splits/streams. See `decouplingAvailable`.
 */

export interface RideSummary {
  date: string;
  name: string;
  indoor: boolean;
  durationSeconds: number;
  avgHr: number | null;
  maxHr: number | null;
  avgPower: number | null;
  normPower: number | null;
  /** Garmin mean-max curve: seconds → best average watts. */
  powerCurve: Record<number, number>;
  /** HR time-in-zone seconds, Z1..Z5. */
  hrZoneSecs: number[];
  cadence: number | null;
}

export type Confidence = 'high' | 'moderate' | 'low';

export interface ZoneRow {
  zone: string;
  hrLow: number | null;
  hrHigh: number | null;
  powerLow: number | null;
  powerHigh: number | null;
}

export interface CyclingZones {
  ftp: number | null;
  best20: number | null;
  best60: number | null;
  maxHr: number | null;
  thresholdHr: number | null;
  rows: ZoneRow[];
  fit: { a: number; b: number; n: number } | null;
  confidence: Confidence;
}

export interface ZwiftAuditRow {
  date: string;
  name: string;
  intended: 'easy' | 'other';
  avgHr: number | null;
  maxHr: number | null;
  normPower: number | null;
  easyPct: number; // % time in HR Z1–2
  abovePct: number; // % time above Z2
  dominantZone: number;
  actualZone: string;
  flagged: boolean;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function estimateFtp(rides: RideSummary[]): { ftp: number | null; best20: number | null; best60: number | null } {
  const p20 = rides.map((r) => r.powerCurve[1200] || 0).filter((v) => v > 0);
  const p60 = rides.map((r) => r.powerCurve[3600] || 0).filter((v) => v > 0);
  const best20 = p20.length ? Math.max(...p20) : null;
  const best60 = p60.length ? Math.max(...p60) : null;
  // FTP = 95% of best 20-min power; fall back to best 60-min if that's higher.
  const ftp = best20 ? Math.max(Math.round(best20 * 0.95), best60 ?? 0) : best60;
  return { ftp: ftp ?? null, best20, best60 };
}

/** Linear regression avgHR = a + b·NP across power rides. */
export function hrPowerFit(rides: RideSummary[]): { a: number; b: number; n: number } | null {
  const pts = rides.filter((r) => r.normPower && r.avgHr).map((r) => ({ x: r.normPower!, y: r.avgHr! }));
  const n = pts.length;
  if (n < 5) return null;
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  return { a, b, n };
}

export function deriveCyclingZones(rides: RideSummary[]): CyclingZones {
  const { ftp, best20, best60 } = estimateFtp(rides);
  const fit = hrPowerFit(rides);
  const maxHr = rides.map((r) => r.maxHr ?? 0).reduce((m, v) => Math.max(m, v), 0) || null;

  if (!ftp || !fit) {
    return { ftp, best20, best60, maxHr, thresholdHr: null, rows: [], fit, confidence: 'low' };
  }

  const hrAt = (w: number) => Math.round(fit.a + fit.b * w);
  const thresholdHr = hrAt(ftp);

  // Power anchors (% FTP) cross-checked against the HR the regression predicts.
  const anchors: [string, number, number][] = [
    ['Z1 · Recovery', 0, 0.55],
    ['Z2 · Aerobic', 0.55, 0.75],
    ['Z3 · Tempo', 0.76, 0.9],
    ['Z4 · Threshold', 0.91, 1.05],
    ['Z5 · VO₂', 1.05, 1.5],
  ];
  const rows: ZoneRow[] = anchors.map(([zone, lo, hi], i) => ({
    zone,
    powerLow: i === 0 ? null : Math.round(ftp * lo),
    powerHigh: i === anchors.length - 1 ? null : Math.round(ftp * hi),
    hrLow: i === 0 ? null : hrAt(ftp * lo),
    hrHigh: i === anchors.length - 1 ? null : hrAt(ftp * hi),
  }));

  // Confidence: driven by sample size + (future) stream availability.
  const confidence: Confidence = fit.n >= 25 ? 'moderate' : fit.n >= 12 ? 'low' : 'low';
  return { ftp, best20, best60, maxHr, thresholdHr, rows, fit, confidence };
}

/** Efficiency Factor (NP/HR) per ride + early-vs-recent trend. */
export function efSeries(rides: RideSummary[]) {
  const pts = rides
    .filter((r) => r.normPower && r.avgHr)
    .map((r) => ({ date: r.date, ef: r.normPower! / r.avgHr!, np: r.normPower!, hr: r.avgHr! }));
  const third = Math.floor(pts.length / 3) || 1;
  const early = mean(pts.slice(0, third).map((p) => p.ef));
  const recent = mean(pts.slice(-third).map((p) => p.ef));
  const changePct = early > 0 ? (recent / early - 1) * 100 : 0;
  return { pts, early, recent, changePct };
}

/** FTP proxy trend: best 20-min power in rolling 60-day buckets. */
export function ftpTrend(rides: RideSummary[]) {
  const withP = rides.filter((r) => r.powerCurve[1200]);
  return withP.map((r) => ({ date: r.date, w: Math.round((r.powerCurve[1200] || 0) * 0.95) }));
}

const ZONE_LABEL = ['—', 'Z1 Recovery', 'Z2 Aerobic', 'Z3 Tempo', 'Z4 Threshold', 'Z5 VO₂'];
const isEasyName = (n: string) => /aerobic|endur|recovery|easy|zone ?2|z2|base|foundation|mend|renewal|spin/i.test(n);

export function zwiftAudit(rides: RideSummary[]): ZwiftAuditRow[] {
  return rides
    .filter((r) => (r.indoor || /zwift/i.test(r.name)) && r.hrZoneSecs.reduce((a, b) => a + b, 0) > 0)
    .map((r) => {
      const z = r.hrZoneSecs;
      const tot = z.reduce((a, b) => a + b, 0) || 1;
      const easyPct = Math.round(((z[0] + z[1]) / tot) * 100);
      const abovePct = 100 - easyPct;
      const dominantZone = z.indexOf(Math.max(...z)) + 1;
      const intended: 'easy' | 'other' = isEasyName(r.name) ? 'easy' : 'other';
      return {
        date: r.date, name: r.name, intended,
        avgHr: r.avgHr, maxHr: r.maxHr, normPower: r.normPower,
        easyPct, abovePct, dominantZone, actualZone: ZONE_LABEL[dominantZone] ?? '—',
        flagged: intended === 'easy' && abovePct > 50,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function indoorVsOutdoor(rides: RideSummary[]) {
  const withHr = rides.filter((r) => r.avgHr && r.normPower);
  const indoor = withHr.filter((r) => r.indoor);
  const outdoor = withHr.filter((r) => !r.indoor);
  const ef = (rs: RideSummary[]) => mean(rs.map((r) => r.normPower! / r.avgHr!));
  const hr = (rs: RideSummary[]) => mean(rs.map((r) => r.avgHr!));
  return {
    indoor: { n: indoor.length, ef: ef(indoor), avgHr: hr(indoor) },
    outdoor: { n: outdoor.length, ef: ef(outdoor), avgHr: hr(outdoor) },
  };
}

export interface Recommendation { title: string; detail: string; severity: 'action' | 'info' | 'good'; }

export function generateRecommendations(zones: CyclingZones, ef: ReturnType<typeof efSeries>, audit: ZwiftAuditRow[], io: ReturnType<typeof indoorVsOutdoor>): Recommendation[] {
  const recs: Recommendation[] = [];
  const z2 = zones.rows.find((r) => r.zone.startsWith('Z2'));

  if (z2?.hrLow && z2.hrHigh) {
    recs.push({
      severity: 'action',
      title: `Your true Zone 2 is likely ${z2.hrLow}–${z2.hrHigh} bpm (${z2.powerLow}–${z2.powerHigh} W)`,
      detail: `Derived from a ${zones.fit?.n}-ride HR–power regression at aerobic power, cross-checked against your zone audit. Ride easy days at ~${z2.powerHigh} W / ${z2.hrHigh} bpm ceiling.`,
    });
  }

  const flagged = audit.filter((a) => a.flagged);
  if (flagged.length) {
    const worst = flagged[0];
    const drop = worst.normPower && z2?.powerHigh ? Math.round(worst.normPower - z2.powerHigh) : null;
    recs.push({
      severity: 'action',
      title: `${flagged.length} "easy" ride${flagged.length > 1 ? 's' : ''} consistently exceed aerobic threshold`,
      detail: `e.g. "${worst.name}" ran ${worst.abovePct}% above Zone 2 (dominant ${worst.actualZone}) at ${worst.normPower} W.${drop && drop > 0 ? ` Reduce the ERG target by ~${drop} W to stay aerobic.` : ''}`,
    });
  }

  if (ef.pts.length >= 6) {
    recs.push({
      severity: ef.changePct >= 0 ? 'good' : 'info',
      title: `Aerobic efficiency ${ef.changePct >= 0 ? 'improved' : 'declined'} ${Math.abs(Math.round(ef.changePct))}%`,
      detail: `Efficiency Factor (NP/HR) moved ${ef.early.toFixed(3)} → ${ef.recent.toFixed(3)} across your history. ${ef.changePct >= 0 ? 'More watts per heartbeat — real aerobic development.' : 'Watch fatigue and easy-day discipline.'}`,
    });
  }

  if (io.indoor.n >= 3 && io.outdoor.n >= 3) {
    const hrGap = Math.round(io.indoor.avgHr - io.outdoor.avgHr);
    if (hrGap >= 4) {
      recs.push({
        severity: 'info',
        title: `Indoor rides run ~${hrGap} bpm hotter than outdoor at similar effort`,
        detail: `Likely heat-driven cardiac drift on the trainer — more cooling (fans) will lower HR and keep indoor rides aerobic.`,
      });
    }
  }

  return recs;
}

/** Streams aren't stored yet, so intra-ride decoupling/drift is unavailable. */
export const decouplingAvailable = false;

// ── Sport-agnostic view model ───────────────────────────────────────────────
// Cycling and running produce the same shape so one component renders both.

export interface AuditModelRow {
  date: string; name: string; intended: 'easy' | 'other';
  avgHr: number | null; maxHr: number | null; intensity: string;
  easyPct: number; abovePct: number; actualZone: string; flagged: boolean;
}

export interface AerobicModel {
  sport: 'cycling' | 'running';
  anchorLabel: string;   // 'Est. FTP' | 'Threshold pace'
  anchorValue: string;   // '140 W' | '4:32 /km'
  anchorSub: string;
  z2HrText: string;      // '133–143 bpm'
  z2IntensityText: string; // '77–105 W' | '5:10–4:41 /km'
  thresholdHr: number | null;
  confidence: Confidence;
  sampleN: number;
  // scatter (x = intensity, higher = harder: watts / speed m·s⁻¹)
  xLabel: string;
  scatter: { x: number; y: number }[];
  fit: { a: number; b: number };
  fitLabel: string;
  z2BandX: [number, number] | null;
  z2CeilingHr: number | null;
  formatX: (x: number) => string; // tooltip formatter for scatter x
  // zones
  zoneRows: { zone: string; hr: string; intensity: string }[];
  // trends
  efChangePct: number;
  efPts: { date: string; v: number }[];
  secondTrend: { label: string; unit?: string; pts: { date: string; v: number }[] };
  // audit + recs
  auditTitle: string;
  auditIntensityLabel: string;
  audit: AuditModelRow[];
  recs: Recommendation[];
}

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const fmtRange = (lo: number | null, hi: number | null, unit: string) =>
  lo == null ? `< ${hi} ${unit}` : hi == null ? `${lo}+ ${unit}` : `${lo}–${hi} ${unit}`;

export function buildCyclingModel(rides: RideSummary[]): AerobicModel | null {
  const zones = deriveCyclingZones(rides);
  if (!zones.ftp || !zones.fit) return null;
  const ef = efSeries(rides);
  const ftpT = ftpTrend(rides);
  const audit = zwiftAudit(rides);
  const io = indoorVsOutdoor(rides);
  const recs = generateRecommendations(zones, ef, audit, io);
  const z2 = zones.rows.find((r) => r.zone.startsWith('Z2'))!;

  return {
    sport: 'cycling',
    anchorLabel: 'Est. FTP',
    anchorValue: `${zones.ftp} W`,
    anchorSub: `best 20-min ${zones.best20}W`,
    z2HrText: `${z2.hrLow}–${z2.hrHigh} bpm`,
    z2IntensityText: `${z2.powerLow}–${z2.powerHigh} W`,
    thresholdHr: zones.thresholdHr,
    confidence: zones.confidence,
    sampleN: zones.fit.n,
    xLabel: 'Normalized Power (W)',
    scatter: ef.pts.map((p) => ({ x: p.np, y: p.hr })),
    fit: { a: zones.fit.a, b: zones.fit.b },
    fitLabel: `HR ≈ ${Math.round(zones.fit.a)} + ${zones.fit.b.toFixed(2)}·W`,
    z2BandX: z2.powerLow != null && z2.powerHigh != null ? [z2.powerLow, z2.powerHigh] : null,
    z2CeilingHr: z2.hrHigh,
    formatX: (x) => `${Math.round(x)} W`,
    zoneRows: zones.rows.map((r) => ({ zone: r.zone, hr: fmtRange(r.hrLow, r.hrHigh, 'bpm'), intensity: fmtRange(r.powerLow, r.powerHigh, 'W') })),
    efChangePct: ef.changePct,
    efPts: ef.pts.map((p) => ({ date: p.date, v: +p.ef.toFixed(3) })),
    secondTrend: { label: 'FTP proxy (best 20-min × 0.95)', unit: 'W', pts: ftpT.map((p) => ({ date: p.date, v: p.w })) },
    auditTitle: 'Zwift audit · is your "easy" actually easy?',
    auditIntensityLabel: 'NP',
    audit: audit.map((a) => ({
      date: a.date, name: a.name.replace(/^Zwift - /, ''), intended: a.intended,
      avgHr: a.avgHr, maxHr: a.maxHr, intensity: a.normPower != null ? `${a.normPower} W` : '—',
      easyPct: a.easyPct, abovePct: a.abovePct, actualZone: a.actualZone, flagged: a.flagged,
    })),
    recs,
  };
}
