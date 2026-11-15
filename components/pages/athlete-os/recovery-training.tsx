import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine,
} from 'recharts';

import type { DailyMatrix } from '@/lib/athlete-os/types';
import type { PlanPayload } from '@/pages/api/athlete-os/plan';
import {
  BAND_COLOR, BAND_LABEL, bandOf, recoveryCost, recoveryPerformance, summarizeBands, type Band, type CostGroup, type SessionType,
} from '@/lib/athlete-os/services/performance/recoveryTraining';
import { addDays, fmtDay } from './plan-ui';

/**
 * Recovery ↔ Training — how readiness shapes your sessions, and how your
 * sessions shape your readiness. Three views on one panel:
 *   1. recovery → performance (scatter + WHOOP-band means)
 *   2. training → recovery ("recovery cost" curves, days 0–3)
 *   3. readiness calendar (daily recovery with sessions, into the upcoming plan)
 */

const TYPE_COLOR: Record<SessionType, string> = { easy: '#2dd4bf', quality: '#a78bfa', long: '#fb923c', other: '#94a3b8' };
const TYPE_LABEL: Record<SessionType, string> = { easy: 'Easy', quality: 'Quality', long: 'Long', other: 'Other' };
const COST_COLOR: Record<CostGroup, string> = { quality: '#a78bfa', long: '#fb923c', easy: '#2dd4bf', rest: '#94a3b8' };
const COST_LABEL: Record<CostGroup, string> = { quality: 'Quality session', long: 'Long run', easy: 'Easy run', rest: 'Rest day' };
const BAND_X: Record<Band, [number, number]> = { red: [0, 34], yellow: [34, 67], green: [67, 100] };
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export default function RecoveryTraining({ matrix, plan }: { matrix: DailyMatrix; plan: PlanPayload }) {
  const [filter, setFilter] = useState<'all' | SessionType>('all');
  const points = useMemo(() => recoveryPerformance(matrix, plan.runTypes), [matrix, plan.runTypes]);
  const shown = points.filter((p) => filter === 'all' || p.type === filter);
  const bands = summarizeBands(shown);
  const costs = useMemo(() => recoveryCost(matrix, plan.runTypes), [matrix, plan.runTypes]);

  const costRows = [0, 1, 2, 3].map((day) => {
    const row: Record<string, number | string | null> = { day: day === 0 ? 'Morning of' : `+${day} day${day > 1 ? 's' : ''}` };
    for (const c of costs) row[c.group] = c.points[day]?.mean != null ? Math.round(c.points[day].mean! * 10) / 10 : null;
    return row;
  });
  const dip = costs
    .filter((c) => c.group !== 'rest' && c.points[1]?.mean != null)
    .sort((a, b) => a.points[1].mean! - b.points[1].mean!)[0];
  const rebound = dip ? dip.points.findIndex((p, i) => i > 1 && p.mean != null && p.mean >= 0) : -1;

  const greenGap = bands[2].mean != null && bands[1].mean != null ? bands[2].mean - bands[1].mean : null;

  return (
    <div className="flex flex-col gap-6 p-5">
      {/* ── 1. Recovery → performance ─────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-12">How readiness shapes your runs</h3>
            <p className="text-xs text-gray-10">Each dot is a run: that morning&apos;s WHOOP recovery vs how fast you ran for the effort, compared with your usual.</p>
          </div>
          <div className="flex overflow-hidden rounded-md border border-gray-6">
            {(['all', 'easy', 'quality', 'long'] as const).map((t) => (
              <button key={t} onClick={() => setFilter(t)}
                className={clsx('px-3 py-1.5 text-xs font-semibold transition-colors', filter === t ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3')}>
                {t === 'all' ? 'All' : TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {bands.map((b) => (
            <div key={b.band} className="flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-3">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-10">
                <span className="h-2 w-2 rounded-full" style={{ background: BAND_COLOR[b.band] }} />{BAND_LABEL[b.band]}
              </span>
              <span className="text-xl font-semibold" style={{ color: b.mean == null ? 'var(--gray-10)' : b.mean >= 0 ? '#10b981' : '#f97316' }}>
                {b.mean != null ? pct(b.mean) : '—'}
              </span>
              <span className="text-[10px] text-gray-10">{b.n} run{b.n === 1 ? '' : 's'}{b.n > 0 && b.n < 5 ? ' · small sample' : ''}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 8, right: 8, bottom: 16, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
            {(['red', 'yellow', 'green'] as Band[]).map((b) => (
              <ReferenceArea key={`area-${b}`} x1={BAND_X[b][0]} x2={BAND_X[b][1]} fill={BAND_COLOR[b]} fillOpacity={0.07} />
            ))}
            <ReferenceLine y={0} stroke="var(--gray-8)" />
            {bands.filter((b) => b.mean != null).map((b) => (
              <ReferenceLine key={`mean-${b.band}`} segment={[{ x: BAND_X[b.band][0] + 1, y: b.mean! }, { x: BAND_X[b.band][1] - 1, y: b.mean! }]}
                stroke={BAND_COLOR[b.band]} strokeWidth={2} strokeDasharray="4 3" />
            ))}
            <XAxis type="number" dataKey="recovery" domain={[0, 100]} ticks={[0, 34, 67, 100]} unit="%"
              tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={{ stroke: 'var(--gray-6)' }}
              label={{ value: 'Morning WHOOP recovery', position: 'bottom', fill: 'var(--gray-10)', fontSize: 10 }} />
            <YAxis type="number" dataKey="perf" tickFormatter={(v) => `${v > 0 ? '+' : ''}${Math.round(Number(v))}%`}
              tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} width={44} />
            <ZAxis range={[44, 44]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as typeof shown[number];
              return (
                <div className="rounded border border-gray-6 bg-gray-2 px-2.5 py-1.5 text-xs text-gray-12">
                  <div className="font-medium">{fmtDay(p.date)} · {TYPE_LABEL[p.type]}</div>
                  <div>Recovery {Math.round(p.recovery)}% · {pct(p.perf)} vs usual</div>
                </div>
              );
            }} />
            {(Object.keys(TYPE_COLOR) as SessionType[]).map((t) => (
              <Scatter key={t} data={shown.filter((p) => p.type === t)} fill={TYPE_COLOR[t]} fillOpacity={0.85} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-11">
          {(Object.keys(TYPE_COLOR) as SessionType[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />{TYPE_LABEL[t]}</span>
          ))}
          <span className="text-gray-10">Dashed lines = band averages</span>
        </div>
        {greenGap != null && filter === 'all' && (
          <p className="text-xs text-gray-11">
            On green mornings you run <span className="font-medium text-gray-12">{greenGap.toFixed(1)} points</span> better for the same effort than on yellow ones.
            {bands[0].n < 5 && ' Red days are too rare to read much into yet.'}
          </p>
        )}
      </section>

      {/* ── 2. Training → recovery ────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-12">What each session costs your recovery</h3>
          <p className="text-xs text-gray-10">Average WHOOP recovery on the days around each session type, vs your 30-day median before it.</p>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={costRows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" vertical={false} />
            <ReferenceLine y={0} stroke="var(--gray-8)" label={{ value: 'your baseline', fill: 'var(--gray-10)', fontSize: 10, position: 'insideTopLeft' }} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v) => `${v > 0 ? '+' : ''}${Math.round(Number(v))}`} tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded border border-gray-6 bg-gray-2 px-2.5 py-1.5 text-xs text-gray-12">
                  <div className="font-medium">{label}</div>
                  {payload.filter((p) => p.value != null).map((p) => (
                    <div key={String(p.dataKey)} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}: {Number(p.value) > 0 ? '+' : ''}{p.value} pts
                    </div>
                  ))}
                </div>
              );
            }} />
            {costs.map((c) => (
              <Line key={c.group} dataKey={c.group} name={COST_LABEL[c.group]} stroke={COST_COLOR[c.group]}
                strokeWidth={c.group === 'rest' ? 1.5 : 2} strokeDasharray={c.group === 'rest' ? '3 3' : undefined} dot={{ r: 3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-11">
          {costs.map((c) => (
            <span key={c.group} className="flex items-center gap-1.5">
              <span className="w-3.5 border-t-2" style={{ borderColor: COST_COLOR[c.group], borderStyle: c.group === 'rest' ? 'dashed' : 'solid' }} />
              {COST_LABEL[c.group]} <span className="text-gray-10">n={c.sessions}</span>
            </span>
          ))}
        </div>
        {dip && dip.points[1].mean! < -5 && (
          <p className="text-xs text-gray-11">
            <span className="font-medium text-gray-12">{COST_LABEL[dip.group]}s cost you the most:</span> recovery drops {Math.abs(Math.round(dip.points[1].mean!))} points
            the next morning{rebound > 1 ? ` and is back to baseline by day ${rebound}` : ''}. Your plan puts lower-body strength the day after Tuesday&apos;s quality run — the low point of the week.
          </p>
        )}
        <p className="text-[10px] text-gray-10">
          “Morning of” is measured before the session, so it shows how recovered you were going in. Long runs fall on weekends, so the day after is
          usually rest and extra sleep, which flatters their curve.
        </p>
      </section>

      {/* ── 3. Readiness calendar ─────────────────────────────────────── */}
      <ReadinessCalendar matrix={matrix} plan={plan} />
    </div>
  );
}

function ReadinessCalendar({ matrix, plan }: { matrix: DailyMatrix; plan: PlanPayload }) {
  const idx = useMemo(() => new Map(matrix.dates.map((d, i) => [d, i])), [matrix.dates]);
  const firstWhoop = matrix.dates.find((d, i) => matrix.series.recovery[i] != null) ?? plan.today;
  const monday = (d: string) => addDays(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7));
  const start = monday(firstWhoop);
  const end = addDays(monday(plan.race.date), 6);
  const weeks: string[] = [];
  for (let w = start; w <= end; w = addDays(w, 7)) weeks.push(w);
  const planned = new Map(plan.runs.map((r) => [r.date, r]));

  // Key sessions on green mornings (past).
  const keyPast = Object.entries(plan.runTypes).filter(([d, t]) => (t === 'quality' || t === 'long') && d < plan.today);
  const keyWithRec = keyPast.map(([d]) => { const i = idx.get(d); return i == null ? null : matrix.series.recovery[i]; }).filter((r): r is number => r != null);
  const keyGreen = keyWithRec.filter((r) => r >= 67).length;

  const cell = (d: string) => {
    const i = idx.get(d);
    const rec = i != null ? matrix.series.recovery[i] : null;
    const past = d <= plan.today;
    const type = past ? plan.runTypes[d] : planned.get(d)?.workoutType === 'race' ? 'race' : (planned.get(d)?.workoutType as SessionType | undefined);
    let bg = 'var(--gray-3)';
    let opacity = 1;
    if (past && rec != null) {
      const b = bandOf(rec);
      bg = BAND_COLOR[b];
      const [lo, hi] = BAND_X[b];
      opacity = 0.45 + 0.55 * Math.min(1, Math.max(0, (rec - lo) / (hi - lo)));
    }
    const label = `${fmtDay(d)}${rec != null && past ? ` · recovery ${Math.round(rec)}%` : ''}${type ? ` · ${type === 'race' ? 'race' : TYPE_LABEL[type as SessionType] ?? type}${past ? '' : ' (planned)'}` : ''}`;
    return { bg, opacity, type, label, isToday: d === plan.today, isRace: d === plan.race.date, future: !past };
  };

  const monthLabels = weeks.map((w, i) => {
    const m = new Date(w + 'T00:00:00Z').getUTCMonth();
    const prev = i > 0 ? new Date(weeks[i - 1] + 'T00:00:00Z').getUTCMonth() : -1;
    return m !== prev ? fmtDay(w, { month: 'short' }) : '';
  });

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-12">Readiness calendar</h3>
        <p className="text-xs text-gray-10">
          Daily WHOOP recovery since July, with your sessions marked — and your Runna plan ahead to race day.
          {keyWithRec.length > 0 && ` ${keyGreen} of ${keyWithRec.length} key sessions landed on green mornings.`}
        </p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-[3px] pl-8">
            {weeks.map((w, i) => <span key={w} className="w-[15px] text-[9px] text-gray-10" style={{ overflow: 'visible', whiteSpace: 'nowrap' }}>{monthLabels[i]}</span>)}
          </div>
          {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
            <div key={dow} className="flex items-center gap-[3px]">
              <span className="w-7 text-[9px] text-gray-10">{['Mon', '', 'Wed', '', 'Fri', '', 'Sun'][dow]}</span>
              {weeks.map((w) => {
                const d = addDays(w, dow);
                const c = cell(d);
                return (
                  <span key={d} title={c.label} aria-label={c.label}
                    className={clsx('relative flex h-[15px] w-[15px] items-center justify-center rounded-[3px]',
                      c.isToday && 'ring-2 ring-teal-400', c.isRace && 'ring-2 ring-orange-500', c.future && c.type && 'outline outline-1 outline-gray-7')}
                    style={{ background: c.bg, opacity: c.opacity }}>
                    {c.type === 'quality' && <span className="h-[5px] w-[5px] rounded-full bg-gray-1" />}
                    {c.type === 'long' && <span className="h-[8px] w-[8px] rounded-full border-[1.5px] border-gray-1" />}
                    {c.type === 'easy' && <span className="h-[3px] w-[3px] rounded-full bg-gray-1" />}
                    {c.type === 'race' && <span className="h-[7px] w-[7px] rotate-45 bg-orange-500" />}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-11">
        {(['red', 'yellow', 'green'] as Band[]).map((b) => (
          <span key={b} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BAND_COLOR[b] }} />{BAND_LABEL[b]}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="flex h-2.5 w-2.5 items-center justify-center rounded-[3px] bg-gray-8"><span className="h-1 w-1 rounded-full bg-gray-1" /></span>Quality</span>
        <span className="flex items-center gap-1.5"><span className="flex h-2.5 w-2.5 items-center justify-center rounded-[3px] bg-gray-8"><span className="h-[7px] w-[7px] rounded-full border border-gray-1" /></span>Long run</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-gray-3 outline outline-1 outline-gray-7" />Planned</span>
      </div>
    </section>
  );
}
