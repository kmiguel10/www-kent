import FitnessWhoopHeatmap from './fitness-whoop-heatmap';
import type { FitnessWhoopRecovery, FitnessWhoopCycle } from '@/pages/fitness';

// WHOOP's recovery colour bands: red < 34, yellow 34–66, green ≥ 67.
function recoveryColor(score: number | null | undefined): string {
  if (score == null) return 'var(--gray-12)';
  if (score >= 67) return '#16a34a';
  if (score >= 34) return '#eab308';
  return '#ef4444';
}

function fmt(value: number | null | undefined, digits = 0, unit = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(digits)}${unit}`;
}

function StatCard({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-6 bg-gray-2 p-4">
      <div className="text-xs font-medium uppercase tracking-widest text-gray-11">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-12" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-10">{sub}</div>}
    </div>
  );
}

export default function FitnessWhoopRecovery({
  recovery,
  cycles,
}: {
  recovery: FitnessWhoopRecovery[];
  cycles: FitnessWhoopCycle[];
}) {
  const latest = recovery[0];

  if (recovery.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-sm text-gray-11">No WHOOP recovery data yet.</p>
        <p className="text-xs text-gray-10">Scores will appear here once the sync worker has pulled from WHOOP.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Recovery"
          value={fmt(latest?.recovery_score, 0, '%')}
          valueColor={recoveryColor(latest?.recovery_score)}
          sub={latest ? new Date(latest.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : undefined}
        />
        <StatCard label="HRV" value={fmt(latest?.hrv_rmssd_milli, 0, ' ms')} sub="rMSSD" />
        <StatCard label="Resting HR" value={fmt(latest?.resting_heart_rate, 0, ' bpm')} />
        <StatCard label="SpO₂ / Skin Temp" value={`${fmt(latest?.spo2_percentage, 0, '%')} · ${fmt(latest?.skin_temp_celsius, 1, '°')}`} />
      </div>

      <div className="rounded-xl border border-gray-6 bg-gray-2">
        <div className="border-b border-gray-7 px-4 py-3">
          <div className="text-sm font-medium text-gray-12">Recovery calendar</div>
          <div className="text-xs text-gray-11">Daily recovery score · this year</div>
        </div>
        <FitnessWhoopHeatmap recovery={recovery} cycles={cycles} />
      </div>
    </div>
  );
}
