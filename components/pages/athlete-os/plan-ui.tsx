import clsx from 'clsx';

import type { RunStatus } from '@/pages/api/athlete-os/plan';
import type { PhaseKey } from '@/lib/athlete-os/plan/types';

export const STATUS_STYLE: Record<RunStatus, { label: string; cls: string }> = {
  completed: { label: 'Completed', cls: 'border-emerald-800 text-emerald-400' },
  modified: { label: 'Shortened', cls: 'border-amber-800 text-amber-400' },
  rescheduled: { label: 'Moved', cls: 'border-sky-800 text-sky-400' },
  skipped: { label: 'Skipped', cls: 'border-gray-7 text-gray-10' },
  unconfirmed: { label: 'No run recorded', cls: 'border-orange-900 text-orange-400' },
  planned: { label: 'Planned', cls: 'border-gray-6 text-gray-10' },
  today: { label: 'Today', cls: 'border-teal-700 text-teal-300' },
};

export function StatusChip({ status }: { status: RunStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={clsx('rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase', s.cls)}>{s.label}</span>;
}

export const PHASE_COLOR: Record<PhaseKey, string> = {
  build: '#8b5cf6', recovery: '#14b8a6', buildup: '#7c3aed', high: '#6d28d9', peak: '#a855f7',
  earlyTaper: '#64748b', lateTaper: '#475569', race: '#f97316',
};

export const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

export function fmtPaceS(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return '—';
  const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}
