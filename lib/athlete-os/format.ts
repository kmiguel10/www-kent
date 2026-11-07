import type { MetricKey } from '@/lib/athlete-os/types';
import { METRICS } from '@/lib/athlete-os/metrics/registry';

/** Decimal hours past midnight-of-the-evening (24.5 = 00:30) → "12:30 am". */
export function fmtClock(h: number): string {
  const total = Math.round(((h % 24) + 24) % 24 * 60);
  const hh = Math.floor(total / 60) % 24, mm = total % 60;
  const ampm = hh >= 12 ? 'pm' : 'am';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

export function fmtMinutes(min: number): string {
  const sign = min < 0 ? '−' : '';
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60), m = a % 60;
  return h ? `${sign}${h}h ${String(m).padStart(2, '0')}m` : `${sign}${m}m`;
}

/** Human-readable value for any metric (used for thresholds, today's values, tooltips). */
export function fmtMetric(key: MetricKey, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  switch (key) {
    case 'bedtime': return fmtClock(v);
    case 'bedtimeShift': return `±${fmtMinutes(v * 60)}`;
    case 'steps': return Math.round(v).toLocaleString('en-US');
    case 'runPerf':
    case 'ridePerf': return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    case 'runEfficiency':
    case 'rideEfficiency': return v.toFixed(2);
    case 'skinTemp': return `${v.toFixed(1)}°C`;
    case 'respiratoryRate': return `${v.toFixed(1)} rpm`;
    default: break;
  }
  const unit = METRICS[key].unit;
  if (unit === 'min') return fmtMinutes(v);
  if (unit === '%') return `${Math.round(v)}%`;
  if (unit === 'ms' || unit === 'bpm') return `${Math.round(v)} ${unit}`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
