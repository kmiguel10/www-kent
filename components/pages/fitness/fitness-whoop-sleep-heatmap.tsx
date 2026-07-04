import { type FC, useMemo } from 'react';

import FitnessWhoopCalendar, { type TooltipRow } from './fitness-whoop-calendar';
import type { FitnessWhoopSleep } from '@/pages/fitness';

// Sleep performance bands: red < 70, yellow 70–84, green ≥ 85.
function bandColor(pct: number): string {
  if (pct >= 85) return '#16a34a';
  if (pct >= 70) return '#eab308';
  return '#ef4444';
}

function fmtHm(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const FitnessWhoopSleepHeatmap: FC<{ sleep: FitnessWhoopSleep[] }> = ({ sleep }) => {
  const nonNap = useMemo(() => sleep.filter((s) => !s.nap), [sleep]);

  const valueByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of nonNap) if (s.sleep_performance_percentage != null) map[s.date] = s.sleep_performance_percentage;
    return map;
  }, [nonNap]);

  const sleepByDate = useMemo(() => new Map(nonNap.map((s) => [s.date, s])), [nonNap]);

  const tooltipRows = (date: string): TooltipRow[] => {
    const s = sleepByDate.get(date);
    const rows: TooltipRow[] = [];
    if (s?.sleep_performance_percentage != null) rows.push({ label: 'Performance', value: `${Math.round(s.sleep_performance_percentage)}%`, color: bandColor(s.sleep_performance_percentage) });
    if (s?.sleep_efficiency_percentage != null) rows.push({ label: 'Efficiency', value: `${Math.round(s.sleep_efficiency_percentage)}%` });
    if (s?.in_bed_minutes != null && s?.awake_minutes != null) rows.push({ label: 'Asleep', value: fmtHm(s.in_bed_minutes - s.awake_minutes) });
    if (s?.respiratory_rate != null) rows.push({ label: 'Respiratory', value: s.respiratory_rate.toFixed(1) });
    return rows;
  };

  return (
    <FitnessWhoopCalendar
      valueByDate={valueByDate}
      colorFor={bandColor}
      avgText={(avg) => (avg == null ? 'No sleep data' : `${Math.round(avg)}% avg sleep performance in ${new Date().getFullYear()}`)}
      tooltipRows={tooltipRows}
      legend={
        <>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#ef4444' }} />0–69</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#eab308' }} />70–84</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#16a34a' }} />85–100</span>
        </>
      }
    />
  );
};

export default FitnessWhoopSleepHeatmap;
