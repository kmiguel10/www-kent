import { motion } from 'framer-motion';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import { Flag, Check, AlertTriangle } from 'lucide-react';

import { type GoalModel, fmtTime, fmtPace } from '@/lib/athlete-os/services/marathon/marathonGoal';
import type { Roadmap, Phase } from '@/lib/athlete-os/services/marathon/roadmap';

const PHASE_COLOR: Record<Phase, string> = { base: '#0090FF', build: '#a855f7', peak: '#f97316', taper: '#10b981' };
const shortMonth = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

/**
 * Marathon Goal — north-star tracker (Garmin runs only). Shows a transparent
 * three-estimator prediction (race efforts, aerobic curve, VO₂max ceiling), a
 * weekly rolling trajectory, and a saturating projection band to race day
 * against the target glide path. Everything carries pace (min/km) too.
 */

const paceOf = (sec: number) => sec / 42.195; // marathon pace from finish time
const RACE = '2027-01-31';
const DAY = 864e5;

function fmtDelta(sec: number): string {
  const a = Math.abs(sec);
  const h = Math.floor(a / 3600), m = Math.round((a % 3600) / 60);
  return `${sec >= 0 ? '+' : '−'}${h > 0 ? `${h}h ` : ''}${m}m`;
}
const weekLabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const TAU = 10; // must match the goal engine's saturation constant
const sat = (slope: number, w: number) => slope * TAU * (1 - Math.exp(-w / TAU));

export default function MarathonGoal({ model, roadmap }: { model: GoalModel; roadmap: Roadmap }) {
  const gap = model.gapSeconds;
  const predColor = gap == null ? 'var(--gray-12)' : gap <= 0 ? '#10b981' : gap < 30 * 60 ? '#eab308' : '#f97316';
  const raceDate = new Date(RACE + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  // ── Weekly chart: rolling estimate + VO₂max ceiling (past) → projection band + target glide (future)
  const now = Date.now();
  const raceMs = Date.parse(RACE + 'T00:00:00Z');
  // Target glide = the roadmap's bi-weekly trajectory from today to race day.
  const glide = [...roadmap.trajectory].map((p) => ({ t: Date.parse(p.date + 'T00:00:00Z'), sec: p.predictedMin * 60 })).sort((a, b) => a.t - b.t);
  const targetAt = (t: number): number | undefined => {
    if (!glide.length || t < glide[0].t - 7 * DAY) return undefined;
    if (t <= glide[0].t) return glide[0].sec;
    for (let i = 0; i + 1 < glide.length; i++) {
      const a = glide[i], b = glide[i + 1];
      if (t >= a.t && t <= b.t) return a.sec + ((t - a.t) / (b.t - a.t)) * (b.sec - a.sec);
    }
    return t <= raceMs ? glide[glide.length - 1].sec : undefined;
  };
  type Row = { label: string; actual?: number; ceiling?: number; projection?: number; band?: [number, number]; target?: number };
  const rows: Row[] = model.trend.map((w) => {
    const t = Date.parse(w.week + 'T00:00:00Z');
    const tg = targetAt(t);
    return {
      label: weekLabel(w.week),
      actual: w.predicted != null ? Math.round(w.predicted / 60) : undefined,
      ceiling: w.ceiling != null ? Math.round(w.ceiling / 60) : undefined,
      target: tg != null ? Math.round(tg / 60) : undefined,
    };
  });
  const slope = model.improvementPerWeek != null ? -model.improvementPerWeek : null;
  if (model.predictedSeconds != null && slope != null) {
    const p0 = model.predictedSeconds;
    const lastActual = rows[rows.length - 1];
    if (lastActual) { lastActual.projection = Math.round(p0 / 60); lastActual.band = [Math.round(p0 / 60), Math.round(p0 / 60)]; }
    const weeksLeft = Math.max(0, (raceMs - now) / (7 * DAY));
    const W = model.weeksToRace || 1;
    for (let w = 1; w <= Math.ceil(weeksLeft); w++) {
      const t = Math.min(now + w * 7 * DAY, raceMs);
      const frac = Math.min(w, weeksLeft);
      const mid = p0 + sat(slope, frac);
      // Scale the engine's race-day low/high spread proportionally along the way.
      const k = sat(1, frac) / sat(1, W);
      const lo = model.projectedLow != null && model.projectedAtRace != null ? mid + (model.projectedLow - model.projectedAtRace) * k : mid;
      const hi = model.projectedHigh != null && model.projectedAtRace != null ? mid + (model.projectedHigh - model.projectedAtRace) * k : mid;
      const tg = targetAt(t);
      rows.push({
        label: weekLabel(new Date(t).toISOString().slice(0, 10)),
        projection: Math.round(mid / 60),
        band: [Math.round(Math.min(lo, hi) / 60), Math.round(Math.max(lo, hi) / 60)],
        target: tg != null ? Math.round(tg / 60) : undefined,
      });
    }
  }

  const targetMin = model.targetSeconds / 60;
  const currentPace = model.predictedSeconds != null ? fmtPace(paceOf(model.predictedSeconds)) : null;
  const vals = rows.flatMap((r) => [r.actual, r.ceiling, r.projection, r.target, ...(r.band ?? [])].filter((v): v is number => v != null));
  const yDomain: [number, number] = [Math.floor(Math.min(targetMin, ...vals) - 6), Math.ceil(Math.max(targetMin, ...vals) + 6)];
  const timeTick = (v: number) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`;
  const paceTick = (v: number) => fmtPace(paceOf(v * 60));

  const onPace = model.onTrack;
  const rate = model.improvementPerWeek;
  const needed = model.neededImprovementPerWeek;
  const engineGap = model.predictedSeconds != null && model.ceilingSeconds != null ? model.predictedSeconds - model.ceilingSeconds : null;

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Hero row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-6 bg-gray-2" style={{ color: '#2dd4bf' }}>
            <Flag size={20} />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-12">{model.label}</div>
            <div className="text-xs text-gray-10">{raceDate} · {model.weeksToRace} weeks out · target {fmtTime(model.targetSeconds)} ({fmtPace(model.marathonPaceSecPerKm)}/km)</div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${onPace ? 'border-green-800 text-green-400' : 'border-orange-800 text-orange-400'}`}>
          {onPace ? <Check size={13} /> : <AlertTriangle size={13} />}
          {onPace ? 'Projected to hit sub-4' : 'Projected to miss sub-4'}
        </div>
      </div>

      {/* Current prediction + race-day projection + gap */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <motion.div className="col-span-2 flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-4 sm:col-span-1"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <span className="text-[10px] uppercase tracking-wider text-gray-10">If you raced today</span>
          <span className="text-3xl font-semibold" style={{ color: predColor }}>{fmtTime(model.predictedSeconds)}</span>
          <span className="text-[10px] text-gray-10">
            {currentPace ? `${currentPace}/km` : ''}
            {model.rangeLow != null && model.rangeHigh != null && model.rangeLow !== model.rangeHigh ? ` · range ${fmtTime(model.rangeLow)}–${fmtTime(model.rangeHigh)}` : ''}
          </span>
        </motion.div>
        <Metric label="Projected race day" value={fmtTime(model.projectedAtRace)}
          sub={model.projectedLow != null && model.projectedHigh != null ? `likely ${fmtTime(Math.min(model.projectedLow, model.projectedHigh))}–${fmtTime(Math.max(model.projectedLow, model.projectedHigh))}` : 'needs ~4 weeks of data'}
          color={model.projectedAtRace != null ? (model.projectedAtRace <= model.targetSeconds ? '#10b981' : '#f97316') : undefined} />
        <Metric label="Gap to sub-4" value={gap != null ? fmtDelta(gap) : '—'}
          sub={model.predictedSeconds != null ? `${fmtPace(paceOf(model.predictedSeconds) - model.marathonPaceSecPerKm)}/km faster needed` : ''} color={predColor} />
        <Metric label="Required half" value={fmtTime(model.requiredHalf)} sub={`${fmtPace(model.requiredHalf / 21.0975)}/km · 10K ${fmtTime(model.required10k)}`} />
      </div>

      {/* Estimators — transparent breakdown */}
      <div className="grid gap-3 sm:grid-cols-3">
        {model.estimators.map((e) => (
          <div key={e.key} className="flex flex-col gap-1 rounded-xl border border-gray-6 bg-gray-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-11">{e.label}</span>
              {e.key === 'vo2' && <span className="rounded-full bg-gray-3 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-400">ceiling</span>}
            </div>
            <span className="text-xl font-semibold text-gray-12">{fmtTime(e.seconds)}</span>
            <span className="text-[10px] text-gray-10">{e.seconds != null ? `${fmtPace(paceOf(e.seconds))}/km · ` : ''}{e.note}</span>
          </div>
        ))}
      </div>
      {engineGap != null && engineGap > 20 * 60 && (
        <div className="rounded-lg border border-gray-6 bg-gray-2 px-4 py-3 text-sm text-gray-11">
          <span className="font-semibold text-emerald-400">Your engine is ahead of your legs.</span>{' '}
          VO₂max {model.vo2max} supports ~{fmtTime(model.ceilingSeconds)}, but your race-specific running predicts {fmtTime(model.predictedSeconds)} — a{' '}
          {fmtDelta(engineGap).replace('+', '')} gap. That gap is endurance and running economy, not aerobic capacity: long runs, steady
          marathon-pace work and consistent volume are what convert it.
        </div>
      )}

      {/* Trajectory chart */}
      <div className="rounded-xl border border-gray-6 bg-gray-2 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-11">Trajectory to race day</span>
          <span className="text-[10px] text-gray-10">
            {rate != null ? (rate > 0 ? `improving ~${Math.round(rate)}s/week` : `slipping ~${Math.round(-rate)}s/week`) : 'needs ~4 weeks of data'}
            {needed != null && needed > 0 ? ` · need ~${Math.round(needed)}s/week for sub-4` : ''}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis yAxisId="time" width={46} domain={yDomain} reversed tickFormatter={timeTick} tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="pace" orientation="right" width={44} domain={yDomain} reversed tickFormatter={paceTick}
              tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} />
            <ReferenceLine yAxisId="time" y={targetMin} stroke="#2dd4bf" strokeDasharray="5 4"
              label={{ value: `sub-4 · ${fmtPace(model.marathonPaceSecPerKm)}/km`, fill: '#2dd4bf', fontSize: 10, position: 'insideTopLeft' }} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const items = payload.filter((p) => p.value != null && p.dataKey !== 'band');
              if (!items.length) return null;
              return (
                <div className="rounded border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-md">
                  <div className="mb-1 font-medium text-gray-12">{label}</div>
                  {items.map((p) => (
                    <div key={p.dataKey as string} className="flex items-center gap-2 text-gray-11">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-gray-12">{fmtTime((p.value as number) * 60)} · {fmtPace(paceOf((p.value as number) * 60))}/km</span>
                    </div>
                  ))}
                </div>
              );
            }} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="plainline" />
            <Area yAxisId="time" dataKey="band" name="Likely range" stroke="none" fill="#f97316" fillOpacity={0.15} legendType="none" connectNulls />
            <Line yAxisId="time" type="monotone" dataKey="ceiling" name="VO₂max ceiling" stroke="#10b981" strokeWidth={1.5} strokeDasharray="2 3" dot={false} connectNulls />
            <Line yAxisId="time" type="monotone" dataKey="actual" name="Race-ready estimate" stroke="#0090FF" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            <Line yAxisId="time" type="monotone" dataKey="projection" name="Projection" stroke="#f97316" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            <Line yAxisId="time" type="monotone" dataKey="target" name="Target glide" stroke="#2dd4bf" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[10px] text-gray-10">
          Up = faster. Blue: your rolling 8-week marathon estimate (race efforts + aerobic curve). Green: what your VO₂max could support.
          Orange: projection to race day from your current rate of improvement (robust slope, tapering gains), shaded = likely range.
        </p>
      </div>

      {/* Checkpoints — the periodized target stats at each milestone */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">Checkpoints · target stats by date</span>
        <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
          {roadmap.checkpoints.map((c) => (
            <div key={c.monthsOut} className="flex min-w-[150px] flex-1 flex-col gap-2 rounded-xl border border-gray-6 bg-gray-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-12">{c.label}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase" style={{ color: PHASE_COLOR[c.phase], background: 'var(--gray-3)' }}>{c.phase}</span>
              </div>
              <span className="text-[10px] text-gray-10">{shortMonth(c.date)} {new Date(c.date + 'T00:00:00Z').getUTCFullYear()}</span>
              <CkRow label="Finish" value={fmtTime(c.predictedSec)} highlight={c.monthsOut === 0} />
              <CkRow label="Pace" value={`${fmtPace(c.paceSecPerKm)}/km`} />
              <CkRow label="Volume" value={`${c.volumeKm} km/wk`} />
              <CkRow label="Long run" value={`${c.longestKm} km`} />
              <CkRow label="Easy" value={`${c.aerobicPct}%`} />
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-gray-10">
          A reverse-periodized sub-4 build: base → build → peak (~3–5 wks out) → taper. Targets to train toward — hit them and the finish time follows.
        </p>
      </div>

      {/* Levers */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">What closes the gap</span>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {model.levers.map((l) => (
            <div key={l.key} className="flex flex-col gap-1 rounded-xl border border-gray-6 bg-gray-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-11">{l.label}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: l.status === 'good' ? '#10b981' : l.status === 'warn' ? '#eab308' : '#f97316' }} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold text-gray-12">{l.value}</span>
                <span className="text-[10px] text-gray-10">/ {l.target}</span>
              </div>
              <span className="text-[10px] text-gray-10">{l.hint}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PRs with pace */}
      {model.prs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-10">
          <span className="font-medium text-gray-11">Garmin bests:</span>
          {model.prs.map((p) => (
            <span key={p.name}>{p.name} <span className="text-gray-12">{fmtTime(p.seconds)}</span> ({fmtPace(p.paceSecPerKm)}/km)</span>
          ))}
        </div>
      )}
    </div>
  );
}

function CkRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-10">{label}</span>
      <span className={highlight ? 'font-semibold text-teal-400' : 'font-medium text-gray-12'}>{value}</span>
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-4">
      <span className="text-[10px] uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-2xl font-semibold text-gray-12" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="text-[10px] text-gray-10">{sub}</span>}
    </div>
  );
}
