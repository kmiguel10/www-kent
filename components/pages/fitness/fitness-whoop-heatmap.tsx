import { type FC, useMemo } from 'react';

import FitnessWhoopCalendar, { type TooltipRow } from './fitness-whoop-calendar';
import type { FitnessWhoopRecovery, FitnessWhoopCycle } from '@/pages/fitness';

// WHOOP's recovery colour bands: red < 34, yellow 34–66, green ≥ 67.
function bandColor(score: number): string {
  if (score >= 67) return '#16a34a';
  if (score >= 34) return '#eab308';
  return '#ef4444';
}

const FitnessWhoopHeatmap: FC<{
  recovery: FitnessWhoopRecovery[];
  cycles: FitnessWhoopCycle[];
}> = ({ recovery, cycles }) => {
  const valueByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of recovery) if (r.recovery_score != null) map[r.date] = r.recovery_score;
    return map;
  }, [recovery]);

  const recoveryByDate = useMemo(() => new Map(recovery.map((r) => [r.date, r])), [recovery]);
  const strainByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cycles) if (c.strain != null) map[c.date] = c.strain;
    return map;
  }, [cycles]);

  const tooltipRows = (date: string): TooltipRow[] => {
    const rec = recoveryByDate.get(date);
    const rows: TooltipRow[] = [];
    if (rec?.recovery_score != null) rows.push({ label: 'Recovery', value: `${Math.round(rec.recovery_score)}%`, color: bandColor(rec.recovery_score) });
    if (rec?.hrv_rmssd_milli != null) rows.push({ label: 'HRV', value: `${Math.round(rec.hrv_rmssd_milli)} ms` });
    if (rec?.resting_heart_rate != null) rows.push({ label: 'Resting HR', value: `${Math.round(rec.resting_heart_rate)} bpm` });
    if (strainByDate[date] != null) rows.push({ label: 'Day strain', value: strainByDate[date].toFixed(1) });
    return rows;
  };

  return (
    <FitnessWhoopCalendar
      valueByDate={valueByDate}
      colorFor={bandColor}
      avgText={(avg) => (avg == null ? 'No recovery data' : `${Math.round(avg)}% avg recovery in ${new Date().getFullYear()}`)}
      tooltipRows={tooltipRows}
      legend={
        <>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#ef4444' }} />0–33</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#eab308' }} />34–66</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#16a34a' }} />67–100</span>
        </>
      }
    />
  );
};

export default FitnessWhoopHeatmap;
