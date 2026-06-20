'use client';

import {
  Fragment,
  useMemo,
  useState,
  useCallback,
  type FC,
  type PointerEvent,
} from 'react';
import clsx from 'clsx';
import { useTooltip, useTooltipInPortal, TooltipWithBounds } from '@visx/tooltip';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  ComposedChart, Line,
  XAxis, YAxis,
  Tooltip as RechartsTip,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { FitnessActivity, FitnessSleepRecord, FitnessRecoveryRecord } from '@/pages/fitness';

type Unit = 'km' | 'mi';

// ── colours ─────────────────────────────────────────────────────────────────
const COLOR_DURATION = '#0090FF';
const COLOR_HRV      = '#8E4EC6';
const COLOR_BATTERY  = '#F76B15';

const SQ = 12, GAP = 2;

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtDur(mins: number | null) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function fmtDate(d: string) {
  const [, m, day] = d.split('-');
  return `${parseInt(m)}/${parseInt(day)}`;
}
function avgOf(arr: (number | null)[]): number | null {
  const v = arr.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((a, b) => a + b) / v.length) * 10) / 10 : null;
}
function scoreColor(s: number | null): string {
  if (s == null) return 'transparent';
  if (s >= 90) return '#46A758';
  if (s >= 75) return '#30A46C';
  if (s >= 60) return '#F76B15';
  return '#E5484D';
}
function scoreLabel(s: number | null): string {
  if (s == null) return 'No data';
  if (s >= 90) return 'Excellent';
  if (s >= 75) return 'Good';
  if (s >= 60) return 'Fair';
  return 'Poor';
}

// ── shared tooltip ───────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-gray-11">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color ?? p.fill }} />
          <span className="text-gray-10">{p.name ?? p.dataKey}:</span>
          <span className="font-medium text-gray-12">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Sleep Score Heatmap ──────────────────────────────────────────────────────
const SleepHeatmap: FC<{ records: FitnessSleepRecord[] }> = ({ records }) => {
  const years = useMemo(() => {
    const s = new Set(records.map((r) => parseInt(r.date.slice(0, 4))));
    return Array.from(s).sort().reverse();
  }, [records]);

  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());

  const { containerRef, containerBounds } = useTooltipInPortal({ scroll: true, detectBounds: true });
  const { showTooltip, hideTooltip, tooltipOpen, tooltipLeft, tooltipTop, tooltipData } =
    useTooltip<string>();

  const handleMove = useCallback((e: PointerEvent<SVGSVGElement>) => {
    const tl = e.clientX - containerBounds.left;
    const tt = e.clientY - containerBounds.top;
    const t = e.target as SVGElement;
    const d = t.getAttribute('data-tip');
    if (d) showTooltip({ tooltipLeft: tl, tooltipTop: tt, tooltipData: d });
    else hideTooltip();
  }, [containerBounds, showTooltip, hideTooltip]);

  const byDate = useMemo(() => {
    const m = new Map<string, FitnessSleepRecord>();
    records.forEach((r) => m.set(r.date, r));
    return m;
  }, [records]);

  const firstDay = useMemo(() => new Date(Date.UTC(year, 0, 1)), [year]);
  const dayOffset = firstDay.getUTCDay();
  const daysInYear = year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0) ? 366 : 365;

  const grid = useMemo(() => {
    const rows: ({ date: string; rec: FitnessSleepRecord | null } | null)[][] =
      Array(7).fill(null).map(() => new Array(53).fill(null));
    const d = new Date(Date.UTC(year, 0, 1));
    for (let i = 0; i < daysInYear; i++) {
      const dow = d.getUTCDay();
      const col = Math.floor(i / 7) + (dow < dayOffset ? 1 : 0);
      const key = d.toISOString().slice(0, 10);
      rows[dow][col] = { date: key, rec: byDate.get(key) ?? null };
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return rows;
  }, [year, dayOffset, daysInYear, byDate]);

  const svgW = 53 * SQ + 52 * GAP;
  const svgH = 7 * SQ + 6 * GAP + 16;
  const yearRecords = records.filter((r) => r.date.startsWith(String(year)));
  const avgScore = avgOf(yearRecords.map((r) => r.sleep_score));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-11">
          {avgScore != null
            ? <><span className="font-semibold text-gray-12">{avgScore}</span> avg sleep score in {year}</>
            : <span>No sleep data for {year}</span>}
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded border border-gray-6 bg-gray-3 px-2 py-0.5 text-sm text-gray-12 focus:outline-none"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="relative">
        <div className="hide-scrollbar overflow-x-auto">
          <svg
            width={svgW} height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            ref={containerRef}
            onPointerMove={handleMove}
            onMouseLeave={hideTooltip}
          >
            {Array(12).fill(null).map((_, month) => {
              const fd = new Date(Date.UTC(year, month, 1));
              const col = Math.ceil((86400 * dayOffset + fd.getTime() - firstDay.getTime()) / 604800000);
              return (
                <text key={month} x={(SQ + GAP) * col} y={12} fontSize={10} className="fill-gray-10">
                  {fd.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
                </text>
              );
            })}
            {grid.map((row, y) => (
              <Fragment key={y}>
                {row.map((cell, x) => {
                  if (!cell) return null;
                  const px = (SQ + GAP) * x + 2;
                  const py = (SQ + GAP) * y + 0.5 + 16;
                  const d = `M${px} ${py}h${SQ-4}q1.5 0 1.5 1.5v${SQ-4}q0 1.5-1.5 1.5h-${SQ-4}q-1.5 0-1.5-1.5v-${SQ-4}q0-1.5 1.5-1.5z`;
                  const score = cell.rec?.sleep_score ?? null;
                  const tip = score != null
                    ? JSON.stringify({ date: cell.date, score, dur: cell.rec?.duration_minutes })
                    : null;
                  return (
                    <path
                      key={`${x}-${y}`}
                      d={d}
                      fill={scoreColor(score)}
                      fillOpacity={score != null ? 0.3 + (score / 100) * 0.7 : 0}
                      className="stroke-gray-7 transition-colors hover:stroke-gray-9"
                      data-tip={tip ?? undefined}
                    />
                  );
                })}
              </Fragment>
            ))}
          </svg>
        </div>

        {tooltipOpen && tooltipData && tooltipLeft != null && tooltipTop != null && (
          <TooltipWithBounds
            key={Math.random()}
            top={tooltipTop} left={tooltipLeft}
            offsetLeft={-SQ}
            className="pointer-events-none absolute left-0 top-0 z-50 rounded border border-gray-6 bg-gray-3 px-2 py-1 text-xs text-gray-12 shadow-md"
            style={{}}
          >
            {(() => {
              const p = JSON.parse(tooltipData);
              return (
                <div>
                  <div className="font-medium" style={{ color: scoreColor(p.score) }}>
                    Score {p.score} · {scoreLabel(p.score)}
                  </div>
                  <div className="text-gray-10">
                    {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                    {p.dur != null && <span className="ml-2">{fmtDur(p.dur)}</span>}
                  </div>
                </div>
              );
            })()}
          </TooltipWithBounds>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-gray-10">
        {[
          { label: 'Poor (<60)', color: '#E5484D' },
          { label: 'Fair (60–74)', color: '#F76B15' },
          { label: 'Good (75–89)', color: '#30A46C' },
          { label: 'Excellent (90+)', color: '#46A758' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Weekly Sleep Score ───────────────────────────────────────────────────────
function WeeklySleepScore({ records }: { records: FitnessSleepRecord[] }) {
  const weeks = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of records) {
      if (r.sleep_score == null) continue;
      const d = new Date(r.date + 'T12:00:00');
      const dow = (d.getDay() + 6) % 7; // Mon = 0
      const mon = new Date(d);
      mon.setDate(d.getDate() - dow);
      const key = mon.toISOString().slice(0, 10);
      (map.get(key) ?? map.set(key, []).get(key)!).push(r.sleep_score);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, scores]) => ({
        week: fmtDate(week),
        avg: Math.round(scores.reduce((a, b) => a + b) / scores.length),
        nights: scores.length,
      }));
  }, [records]);

  if (!weeks.length) return null;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={weeks} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#3c3f44" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} domain={[0, 100]} />
        <RechartsTip content={<ChartTip />} />
        <Bar dataKey="avg" name="Avg Score" radius={[3, 3, 0, 0]}>
          {weeks.map((w, i) => (
            <Cell key={i} fill={scoreColor(w.avg)} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Stage bar ────────────────────────────────────────────────────────────────
function StageBar({ rec }: { rec: FitnessSleepRecord }) {
  const total = (rec.deep_minutes ?? 0) + (rec.light_minutes ?? 0) + (rec.rem_minutes ?? 0) + (rec.awake_minutes ?? 0);
  if (!total) return null;
  const pct = (v: number | null) => `${(((v ?? 0) / total) * 100).toFixed(1)}%`;
  const stages = [
    { label: 'Deep', value: rec.deep_minutes, color: '#0090FF' },
    { label: 'REM', value: rec.rem_minutes, color: '#8E4EC6' },
    { label: 'Light', value: rec.light_minutes, color: '#60646c' },
    { label: 'Awake', value: rec.awake_minutes, color: '#E5484D' },
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {stages.map((s) => (
          <div key={s.label} style={{ width: pct(s.value), backgroundColor: s.color }} title={`${s.label}: ${fmtDur(s.value)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-10">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label} · {fmtDur(s.value)}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-6 bg-gray-2 p-4">
      <div className="text-xs font-medium uppercase tracking-widest text-gray-10">{label}</div>
      <div className={clsx('text-2xl font-semibold', color ?? 'text-gray-12')}>{value}</div>
    </div>
  );
}

// ── Sleep tab ────────────────────────────────────────────────────────────────
function SleepTab({ records }: { records: FitnessSleepRecord[] }) {
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records]);
  const latest = sorted[sorted.length - 1];

  const chart30 = sorted.slice(-30).map((r) => ({
    date: fmtDate(r.date),
    'Duration (h)': r.duration_minutes ? parseFloat((r.duration_minutes / 60).toFixed(1)) : null,
  }));

  if (!records.length) {
    return <div className="flex h-48 items-center justify-center text-sm text-gray-10">No sleep data yet.</div>;
  }

  return (
    <div className="space-y-6 p-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Avg Duration" value={fmtDur(avgOf(records.map((r) => r.duration_minutes)))} />
        <StatTile label="Avg Score"    value={avgOf(records.map((r) => r.sleep_score))?.toString() ?? '—'} color="text-green-400" />
        <StatTile label="Avg Deep"     value={fmtDur(avgOf(records.map((r) => r.deep_minutes)))}  color="text-blue-400" />
        <StatTile label="Avg REM"      value={fmtDur(avgOf(records.map((r) => r.rem_minutes)))}   color="text-purple-400" />
      </div>

      {/* Heatmap */}
      <div>
        <div className="mb-2 text-sm font-medium text-gray-11">Sleep Score Heatmap</div>
        <SleepHeatmap records={records} />
      </div>

      {/* Weekly avg score */}
      <div>
        <div className="mb-2 text-sm font-medium text-gray-11">Weekly Avg Score · last 12 weeks</div>
        <WeeklySleepScore records={records} />
      </div>

      {/* Last night */}
      {latest && (
        <div className="rounded-xl border border-gray-6 bg-gray-2 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-12">Last night · {latest.date}</span>
            {latest.sleep_score != null && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ color: scoreColor(latest.sleep_score), backgroundColor: scoreColor(latest.sleep_score) + '22' }}>
                {scoreLabel(latest.sleep_score)} · {latest.sleep_score}
              </span>
            )}
          </div>
          <div className="mb-3 text-2xl font-semibold text-gray-12">{fmtDur(latest.duration_minutes)}</div>
          <StageBar rec={latest} />
        </div>
      )}

      {/* 30-day duration chart */}
      <div>
        <div className="mb-2 text-sm font-medium text-gray-11">Duration · last 30 nights</div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={chart30} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="durGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_DURATION} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLOR_DURATION} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3c3f44" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} domain={[0, 10]} unit="h" />
            <RechartsTip content={<ChartTip />} />
            <Area type="monotone" dataKey="Duration (h)" stroke={COLOR_DURATION} strokeWidth={2} fill="url(#durGrad)" connectNulls dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Recovery tab ──────────────────────────────────────────────────────────────
function RecoveryTab({ records }: { records: FitnessRecoveryRecord[] }) {
  const sorted = useMemo(() => [...records].sort((a, b) => a.date.localeCompare(b.date)), [records]);
  const latest = sorted[sorted.length - 1];

  const chart30 = sorted.slice(-30).map((r) => ({
    date: fmtDate(r.date),
    HRV: r.hrv,
    'Body Battery': r.body_battery_high,
  }));

  if (!records.length) {
    return <div className="flex h-48 items-center justify-center text-sm text-gray-10">No recovery data yet.</div>;
  }

  return (
    <div className="space-y-6 p-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Avg HRV"          value={avgOf(records.map((r) => r.hrv)) != null ? `${Math.round(avgOf(records.map((r) => r.hrv))!)} ms` : '—'} color="text-purple-400" />
        <StatTile label="Avg Resting HR"   value={avgOf(records.map((r) => r.resting_hr)) != null ? `${Math.round(avgOf(records.map((r) => r.resting_hr))!)} bpm` : '—'} color="text-red-400" />
        <StatTile label="Avg Body Battery" value={avgOf(records.map((r) => r.body_battery_high))?.toString() ?? '—'} color="text-orange-400" />
        <StatTile label="Avg Stress"       value={avgOf(records.map((r) => r.stress_avg))?.toString() ?? '—'} />
      </div>

      {/* Latest summary */}
      {latest && (
        <div className="rounded-xl border border-gray-6 bg-gray-2 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-12">Last night · {latest.date}</span>
            {latest.hrv_status && (
              <span className="rounded-full bg-purple-900/40 px-2.5 py-0.5 text-xs font-medium capitalize text-purple-400">
                HRV {latest.hrv_status.toLowerCase()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {latest.hrv != null             && <div className="text-xs text-gray-10">HRV <span className="ml-1 font-medium text-gray-12">{latest.hrv} ms</span></div>}
            {latest.resting_hr != null      && <div className="text-xs text-gray-10">Resting HR <span className="ml-1 font-medium text-gray-12">{latest.resting_hr} bpm</span></div>}
            {latest.body_battery_high != null && <div className="text-xs text-gray-10">Body Battery <span className="ml-1 font-medium text-gray-12">{latest.body_battery_high}</span></div>}
            {latest.stress_avg != null      && <div className="text-xs text-gray-10">Stress <span className="ml-1 font-medium text-gray-12">{latest.stress_avg}</span></div>}
          </div>
        </div>
      )}

      {/* HRV chart */}
      <div>
        <div className="mb-2 text-sm font-medium text-gray-11">HRV · last 30 nights</div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={chart30} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_HRV} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLOR_HRV} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3c3f44" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} unit=" ms" />
            <RechartsTip content={<ChartTip />} />
            <Area type="monotone" dataKey="HRV" stroke={COLOR_HRV} strokeWidth={2} fill="url(#hrvGrad)" connectNulls dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Body Battery chart */}
      <div>
        <div className="mb-2 text-sm font-medium text-gray-11">Body Battery peak · last 30 days</div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={chart30} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="batGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_BATTERY} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLOR_BATTERY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3c3f44" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} domain={[0, 100]} />
            <RechartsTip content={<ChartTip />} />
            <Area type="monotone" dataKey="Body Battery" stroke={COLOR_BATTERY} strokeWidth={2} fill="url(#batGrad)" connectNulls dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Performance Correlation tab ───────────────────────────────────────────────
function CorrelationTab({
  records, activities, unit,
}: { records: FitnessSleepRecord[]; activities: FitnessActivity[]; unit: Unit }) {
  const data = useMemo(() => {
    const sleepByWeek = new Map<string, number[]>();
    for (const r of records) {
      if (r.sleep_score == null) continue;
      const d = new Date(r.date + 'T12:00:00');
      const dow = (d.getDay() + 6) % 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - dow);
      const key = mon.toISOString().slice(0, 10);
      (sleepByWeek.get(key) ?? sleepByWeek.set(key, []).get(key)!).push(r.sleep_score);
    }

    const distByWeek = new Map<string, number>();
    for (const a of activities) {
      const d = new Date(a.start_time);
      const dow = (d.getDay() + 6) % 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - dow);
      const key = mon.toISOString().slice(0, 10);
      distByWeek.set(key, (distByWeek.get(key) ?? 0) + (a.distance_meters ?? 0) / 1000);
    }

    const allWeeks = Array.from(new Set([...Array.from(sleepByWeek.keys()), ...Array.from(distByWeek.keys())])).sort().slice(-12);
    return allWeeks.map((week) => {
      const scores = sleepByWeek.get(week);
      const sleepScore = scores ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
      const distKm = distByWeek.get(week) ?? 0;
      const distance = distKm > 0
        ? +(unit === 'km' ? distKm : distKm / 1.60934).toFixed(1)
        : null;
      const [, m, day] = week.split('-');
      return { week: `${parseInt(m)}/${parseInt(day)}`, sleepScore, distance };
    });
  }, [records, activities, unit]);

  const hasData = data.some((d) => d.sleepScore != null);

  if (!hasData) {
    return <div className="flex h-48 items-center justify-center text-sm text-gray-10">No sleep data yet.</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-gray-11">Weekly training volume vs avg sleep score · last 12 weeks</p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3c3f44" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} unit={unit === 'km' ? ' km' : ' mi'} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#696e77' }} tickLine={false} domain={[0, 100]} />
          <RechartsTip content={<ChartTip />} />
          <Bar yAxisId="left" dataKey="distance" name={`Distance (${unit})`} fill="#0090FF" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="sleepScore" name="Sleep Score" stroke="#8E4EC6" strokeWidth={2} dot={{ fill: '#8E4EC6', r: 3, strokeWidth: 0 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 text-xs text-gray-10">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#0090FF', opacity: 0.55 }} />
          Training distance
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: '#8E4EC6' }} />
          Sleep score
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export default function FitnessSleep({
  sleep, recovery, activities = [], unit = 'km',
}: {
  sleep: FitnessSleepRecord[];
  recovery: FitnessRecoveryRecord[];
  activities?: FitnessActivity[];
  unit?: Unit;
}) {
  const [tab, setTab] = useState<'sleep' | 'recovery' | 'performance'>('sleep');

  const TAB_LABELS: Record<typeof tab, string> = {
    sleep: 'Sleep',
    recovery: 'Recovery',
    performance: 'vs Training',
  };

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
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
          {(['sleep', 'recovery', 'performance'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t ? 'bg-gray-4 text-gray-12' : 'text-gray-10 hover:bg-gray-3 hover:text-gray-11',
              )}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'sleep' && <SleepTab records={sleep} />}
      {tab === 'recovery' && <RecoveryTab records={recovery} />}
      {tab === 'performance' && <CorrelationTab records={sleep} activities={activities} unit={unit} />}
    </div>
  );
}
