import { formatPace } from './aerobicAnalysis';
import type { DecouplingRow } from '@/pages/api/athlete-os/decoupling';

/**
 * Summarise per-ride decoupling into the aerobic-ceiling view: the highest
 * output (power for cycling, speed for running) that stayed aerobically
 * coupled (< 5% drift), plus a representative drift curve.
 */

export interface DecouplingSummary {
  sport: 'cycling' | 'running';
  count: number;
  aerobicCount: number;
  avgDecoupling: number;
  ceilingOutput: number | null;
  ceilingLabel: string;
  ceilingHr: number | null;
  driftRideName: string | null;
  driftRideDate: string | null;
  driftDecoupling: number | null;
  driftCurve: { min: number; efPct: number }[] | null;
  trend: { date: string; v: number }[];
}

export function summarizeDecoupling(rows: DecouplingRow[], sport: 'cycling' | 'running'): DecouplingSummary | null {
  const sportKey = sport === 'cycling' ? 'ride' : 'run';
  const mine = rows.filter((r) => r.sport === sportKey && r.decouplingPct != null && r.avgOutput != null);
  if (mine.length === 0) return null;

  const aerobic = mine.filter((r) => r.aerobic);
  const avgDecoupling = mine.reduce((s, r) => s + (r.decouplingPct ?? 0), 0) / mine.length;

  // Sustainable aerobic ceiling: highest output among aerobically-coupled efforts.
  let ceilingRow: DecouplingRow | null = null;
  for (const r of aerobic) {
    if (!ceilingRow || (r.avgOutput ?? 0) > (ceilingRow.avgOutput ?? 0)) ceilingRow = r;
  }
  const ceilingOutput = ceilingRow?.avgOutput ?? null;
  const ceilingLabel =
    ceilingOutput == null ? '—' : sport === 'cycling' ? `${Math.round(ceilingOutput)} W` : `${formatPace(1000 / ceilingOutput)} /km`;

  // Representative drift curve: the longest coupled ride with a series.
  const withSeries = mine.filter((r) => r.driftSeries && r.driftSeries.length >= 3);
  withSeries.sort((a, b) => (b.durationMovingSec ?? 0) - (a.durationMovingSec ?? 0));
  const rep = withSeries[0] ?? null;
  const driftCurve = rep?.driftSeries
    ? rep.driftSeries.map((p) => ({ min: Math.round(p.t / 60), efPct: rep.driftSeries![0].ef > 0 ? +((p.ef / rep.driftSeries![0].ef) * 100).toFixed(1) : 100 }))
    : null;

  const trend = mine
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, v: +(r.decouplingPct ?? 0).toFixed(1) }));

  return {
    sport,
    count: mine.length,
    aerobicCount: aerobic.length,
    avgDecoupling: +avgDecoupling.toFixed(1),
    ceilingOutput,
    ceilingLabel,
    ceilingHr: ceilingRow?.avgHr != null ? Math.round(ceilingRow.avgHr) : null,
    driftRideName: rep?.name ?? null,
    driftRideDate: rep?.date ?? null,
    driftDecoupling: rep?.decouplingPct ?? null,
    driftCurve,
    trend,
  };
}
