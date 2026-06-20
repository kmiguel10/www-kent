'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

import type { FitnessSleepRecord, FitnessRecoveryRecord } from '@/pages/fitness';

// ── colours (hex — CSS vars don't resolve in SVG attributes) ────────────────
const COLOR_DURATION = '#0090FF';   // blue-9
const COLOR_SCORE    = '#30A46C';   // green-9
const COLOR_HRV      = '#8E4EC6';   // purple-9
const COLOR_HR       = '#E5484D';   // red-9
const COLOR_BATTERY  = '#F76B15';   // orange-9

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(mins: number | null): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

function avg(arr: (number | null)[], key?: never): number | null {
  const vals = arr.filter((v): v is number => v != null);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
}

// ── sub-components ───────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-6 bg-gray-2 p-4">
      <div className="text-xs font-medium uppercase tracking-widest text-gray-10">{label}</div>
      <div className={clsx('text-2xl font-semibold', color ?? 'text-gray-12')}>{value}</div>
      {sub && <div className="text-xs text-gray-9">{sub}</div>}
    </div>
  );
}

function SleepStageBar({ rec }: { rec: FitnessSleepRecord }) {
  const total = (rec.deep_minutes ?? 0) + (rec.light_minutes ?? 0) + (rec.rem_minutes ?? 0) + (rec.awake_minutes ?? 0);
  if (!total) return null;

  const pct = (v: number | null) => (((v ?? 0) / total) * 100).toFixed(1);

  const stages = [
    { label: 'Deep',  value: rec.deep_minutes,  color: '#0090FF' },
    { label: 'REM',   value: rec.rem_minutes,   color: '#8E4EC6' },
    { label: 'Light', value: rec.light_minutes, color: '#60646c' },
    { label: 'Awake', value: rec.awake_minutes, color: '#E5484D' },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {stages.map((s) => (
          <div
            key={s.label}
            style={{ width: `${pct(s.value)}%`, backgroundColor: s.color }}
            title={`${s.label}: ${fmtDuration(s.value)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-10">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label} · {fmtDuration(s.value)}
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-gray-11">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-10">{p.name}:</span>
          <span className="font-medium text-gray-12">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Sleep tab ────────────────────────────────────────────────────────────────

function SleepTab({ records }: { records: FitnessSleepRecord[] }) {
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records]);
  const latest = sorted[sorted.length - 1];

  const avgDuration = avg(records.map((r) => r.duration_minutes));
  const avgScore    = avg(records.map((r) => r.sleep_score));
  const avgDeep     = avg(records.map((r) => r.deep_minutes));
  const avgRem      = avg(records.map((r) => r.rem_minutes));

  const chartData = sorted.slice(-30).map((r) => ({
    date: fmtDate(r.date),
    'Duration (h)': r.duration_minutes ? parseFloat((r.duration_minutes / 60).toFixed(1)) : null,
    'Score': r.sleep_score,
  }));

  if (!records.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-10">
        No sleep data yet — trigger a sync in Claude Desktop first.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Avg Duration"  value={fmtDuration(avgDuration)} sub={`${records.length} nights`} />
        <StatTile label="Avg Score"     value={avgScore != null ? String(Math.round(avgScore)) : '—'} color="text-green-400" />
        <StatTile label="Avg Deep"      value={fmtDuration(avgDeep)}  color="text-blue-400" />
        <StatTile label="Avg REM"       value={fmtDuration(avgRem)}   color="text-purple-400" />
      </div>

      {/* Last night stage breakdown */}
      {latest && (
        <div className="rounded-xl border border-gray-6 bg-gray-2 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-12">Last night · {latest.date}</span>
            {latest.sleep_score != null && (
              <span className="rounded-full bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-400">
                Score {latest.sleep_score}
              </span>
            )}
          </div>
          <div className="mb-3 text-2xl font-semibold text-gray-12">{fmtDuration(latest.duration_minutes)}</div>
          <SleepStageBar rec={latest} />
        </div>
      )}

      {/* 30-day duration chart */}
      <div className="rounded-xl border border-gray-6 bg-gray-2 p-4">
        <div className="mb-3 text-sm font-medium text-gray-11">Duration · last 30 nights</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLOR_DURATION} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLOR_DURATION} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3c3f44" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} domain={[0, 10]} unit="h" />
            <ReferenceLine y={8} stroke="#60646c" strokeDasharray="4 2" label={{ value: '8h', fill: '#696e77', fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="Duration (h)"
              stroke={COLOR_DURATION}
              strokeWidth={2}
              fill="url(#sleepGrad)"
              connectNulls
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Recovery tab ─────────────────────────────────────────────────────────────

function RecoveryTab({ records }: { records: FitnessRecoveryRecord[] }) {
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records]);
  const latest = sorted[sorted.length - 1];

  const avgHrv      = avg(records.map((r) => r.hrv));
  const avgRhr      = avg(records.map((r) => r.resting_hr));
  const avgBattery  = avg(records.map((r) => r.body_battery_high));
  const avgStress   = avg(records.map((r) => r.stress_avg));

  const chartData = sorted.slice(-30).map((r) => ({
    date: fmtDate(r.date),
    'HRV': r.hrv,
    'Resting HR': r.resting_hr,
    'Body Battery': r.body_battery_high,
  }));

  if (!records.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-10">
        No recovery data yet — trigger a sync in Claude Desktop first.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Avg HRV"         value={avgHrv != null ? `${Math.round(avgHrv)} ms` : '—'} color="text-purple-400" />
        <StatTile label="Avg Resting HR"  value={avgRhr != null ? `${Math.round(avgRhr)} bpm` : '—'} color="text-red-400" />
        <StatTile label="Avg Body Battery" value={avgBattery != null ? String(Math.round(avgBattery)) : '—'} color="text-orange-400" />
        <StatTile label="Avg Stress"      value={avgStress != null ? String(Math.round(avgStress)) : '—'} />
      </div>

      {/* Latest day summary */}
      {latest && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-6 bg-gray-2 p-4 sm:grid-cols-4">
          <div className="text-sm text-gray-11 sm:col-span-4 mb-1 font-medium text-gray-12">
            Last night · {latest.date}
            {latest.hrv_status && (
              <span className="ml-2 rounded-full bg-purple-900/40 px-2.5 py-0.5 text-xs font-medium text-purple-400 capitalize">
                HRV {latest.hrv_status.toLowerCase()}
              </span>
            )}
          </div>
          {latest.hrv            != null && <div className="text-xs text-gray-10">HRV <span className="ml-1 text-gray-12 font-medium">{latest.hrv} ms</span></div>}
          {latest.resting_hr     != null && <div className="text-xs text-gray-10">Resting HR <span className="ml-1 text-gray-12 font-medium">{latest.resting_hr} bpm</span></div>}
          {latest.body_battery_high != null && <div className="text-xs text-gray-10">Body Battery <span className="ml-1 text-gray-12 font-medium">{latest.body_battery_high}</span></div>}
          {latest.stress_avg     != null && <div className="text-xs text-gray-10">Stress <span className="ml-1 text-gray-12 font-medium">{latest.stress_avg}</span></div>}
        </div>
      )}

      {/* 30-day HRV + body battery chart */}
      <div className="rounded-xl border border-gray-6 bg-gray-2 p-4">
        <div className="mb-3 text-sm font-medium text-gray-11">HRV · last 30 nights</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLOR_HRV} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLOR_HRV} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3c3f44" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} unit=" ms" />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="HRV"
              stroke={COLOR_HRV}
              strokeWidth={2}
              fill="url(#hrvGrad)"
              connectNulls
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export default function FitnessSleep({
  sleep,
  recovery,
}: {
  sleep: FitnessSleepRecord[];
  recovery: FitnessRecoveryRecord[];
}) {
  const [tab, setTab] = useState<'sleep' | 'recovery'>('sleep');

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
      {/* Header */}
      <div className="flex h-[4.5rem] items-center justify-between border-b border-gray-7 px-4">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-6 bg-gray-3 text-gray-11">
            <MoonIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium text-gray-12">Sleep & Recovery</div>
            <div className="text-sm text-gray-11">Synced from Garmin Connect</div>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-gray-6">
          {(['sleep', 'recovery'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-gray-4 text-gray-12' : 'text-gray-10 hover:bg-gray-3 hover:text-gray-11',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'sleep'
        ? <SleepTab    records={sleep}    />
        : <RecoveryTab records={recovery} />
      }
    </div>
  );
}
