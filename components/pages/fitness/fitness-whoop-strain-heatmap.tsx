import { type FC, useMemo } from 'react';

import FitnessWhoopCalendar, { type TooltipRow } from './fitness-whoop-calendar';
import type { FitnessWhoopCycle } from '@/pages/fitness';

// WHOOP strain zones: light (0–9), moderate (10–13), strenuous (14–17), all-out (18–21).
function zoneColor(strain: number): string {
  if (strain >= 18) return '#ef4444';
  if (strain >= 14) return '#f97316';
  if (strain >= 10) return '#a855f7';
  return '#6366f1';
}

const FitnessWhoopStrainHeatmap: FC<{ cycles: FitnessWhoopCycle[] }> = ({ cycles }) => {
  const valueByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cycles) if (c.strain != null) map[c.date] = c.strain;
    return map;
  }, [cycles]);

  const cycleByDate = useMemo(() => new Map(cycles.map((c) => [c.date, c])), [cycles]);

  const tooltipRows = (date: string): TooltipRow[] => {
    const c = cycleByDate.get(date);
    const rows: TooltipRow[] = [];
    if (c?.strain != null) rows.push({ label: 'Day strain', value: c.strain.toFixed(1), color: zoneColor(c.strain) });
    if (c?.kilojoules != null) rows.push({ label: 'Energy', value: `${Math.round(c.kilojoules / 4.184).toLocaleString()} kcal` });
    if (c?.avg_heart_rate != null) rows.push({ label: 'Avg HR', value: `${Math.round(c.avg_heart_rate)} bpm` });
    return rows;
  };

  return (
    <FitnessWhoopCalendar
      valueByDate={valueByDate}
      colorFor={zoneColor}
      avgText={(avg) => (avg == null ? 'No strain data' : `${avg.toFixed(1)} avg strain in ${new Date().getFullYear()}`)}
      tooltipRows={tooltipRows}
      legend={
        <>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#6366f1' }} />0–9</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#a855f7' }} />10–13</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#f97316' }} />14–17</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#ef4444' }} />18–21</span>
        </>
      }
    />
  );
};

export default FitnessWhoopStrainHeatmap;
