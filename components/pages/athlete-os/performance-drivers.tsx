import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Moon, Activity, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

import type { DailyMatrix, MetricKey } from '@/lib/athlete-os/types';
import { METRICS } from '@/lib/athlete-os/metrics/registry';
import { computeDrivers, tercileOf, type DriverEffect } from '@/lib/athlete-os/services/performance/drivers';
import { fmtMetric } from '@/lib/athlete-os/format';

/**
 * What drives your performance — ranks WHOOP sleep / recovery / behavior
 * signals by how much they move your Garmin run or ride performance (efficiency
 * vs your own 28-day baseline), and turns today's WHOOP numbers into a forecast.
 */

type Target = 'runPerf' | 'ridePerf';
const TARGET_LABEL: Record<Target, string> = { runPerf: 'Runs', ridePerf: 'Rides' };
const CONF_STYLE = {
  high: 'text-emerald-400 border-emerald-900',
  moderate: 'text-amber-400 border-amber-900',
  low: 'text-gray-10 border-gray-6',
} as const;

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/**
 * The driver value that applies to TODAY: this morning's WHOOP value, or — for
 * lagged daytime drivers (strain, load, steps) — yesterday's completed day.
 * Stale values (older than that) are ignored rather than passed off as today's.
 */
function todayValue(matrix: DailyMatrix, key: MetricKey, lag: 0 | 1): { v: number; date: string } | null {
  // Viewer's LOCAL calendar day (WHOOP dates by wake day; UTC would roll over at ~7 pm ET).
  const d = new Date();
  const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const want = new Date(Date.parse(todayIso + 'T00:00:00Z') - lag * 864e5).toISOString().slice(0, 10);
  const i = matrix.dates.indexOf(want);
  const v = i >= 0 ? matrix.series[key]?.[i] : null;
  return v != null ? { v, date: want } : null;
}

export default function PerformanceDrivers({ matrix }: { matrix: DailyMatrix }) {
  const [target, setTarget] = useState<Target>('runPerf');
  const all = useMemo(() => computeDrivers(matrix), [matrix]);
  const effects = all.filter((e) => e.target === target);
  const strong = effects.filter((e) => e.confidence !== 'low');
  const weak = effects.filter((e) => e.confidence === 'low').slice(0, 6);
  const sessions = matrix.series[target].filter((v) => v != null).length;
  // Sessions that line up with a WHOOP night (Garmin-only drivers like training load excluded).
  const paired = effects.filter((e) => METRICS[e.driver].source !== 'garmin').reduce((m, e) => Math.max(m, e.n), 0);

  // Forecast: where today's WHOOP values sit for the strongest drivers.
  const forecast = useMemo(() => {
    const rows = (strong.length ? strong : effects).slice(0, 4).flatMap((e) => {
      const lagged = e.lag === 1;
      const now = todayValue(matrix, e.driver, e.lag);
      if (!now) return [];
      const band = tercileOf(e, now.v);
      const expected = band === 'high' ? e.highMean : band === 'low' ? e.lowMean : (e.highMean + e.lowMean) / 2;
      return [{ e, now, band, expected, lagged }];
    });
    const avg = rows.length ? rows.reduce((s, r) => s + r.expected, 0) / rows.length : null;
    return { rows, avg };
  }, [strong, effects, matrix]);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-gray-10">
          Performance = how fast you ran (grade-adjusted) or how much power you held, compared with what your own recent
          heart-rate curve predicts at that session's effort. Intensity is controlled, so a hard workout isn't mistaken for a
          "good day". Each night of WHOOP data is paired with that day's Garmin session.
        </p>
        <div className="flex overflow-hidden rounded-md border border-gray-6">
          {(Object.keys(TARGET_LABEL) as Target[]).map((t) => (
            <button key={t} onClick={() => setTarget(t)}
              className={clsx('px-4 py-1.5 text-xs font-semibold transition-colors', target === t ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3')}>
              {TARGET_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {effects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-6 bg-gray-2 px-4 py-6 text-center text-sm text-gray-10">
          Not enough overlap yet — need at least 10 {TARGET_LABEL[target].toLowerCase()} on days with WHOOP data ({sessions} scored so far).
        </div>
      ) : (
        <>
          {/* Today's forecast */}
          {forecast.avg != null && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-6 bg-gray-2 p-4">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-teal-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">Today's forecast</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-semibold" style={{ color: forecast.avg >= 0 ? '#10b981' : '#f97316' }}>{pct(forecast.avg)}</span>
                <span className="text-sm text-gray-11">
                  expected {TARGET_LABEL[target].toLowerCase().slice(0, -1)} performance vs your usual, based on days that looked like today
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {forecast.rows.map(({ e, now, band, lagged }) => (
                  <span key={e.driver} className="rounded-full border border-gray-6 bg-gray-3 px-2.5 py-1 text-[11px] text-gray-11">
                    {lagged ? 'Yesterday ' : ''}{METRICS[e.driver].short} <span className="font-medium text-gray-12">{fmtMetric(e.driver, now.v)}</span>
                    <span className={clsx('ml-1', band === 'high' ? 'text-sky-400' : band === 'low' ? 'text-orange-400' : 'text-gray-10')}>
                      · {band === 'high' ? 'top' : band === 'low' ? 'bottom' : 'middle'} third
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ranked drivers */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">What moves your {TARGET_LABEL[target].toLowerCase()}</span>
              <span className="text-[10px] text-gray-10">{paired} sessions paired with WHOOP · {sessions} scored total</span>
            </div>
            {strong.length === 0 && (
              <p className="rounded-lg border border-gray-6 bg-gray-2 px-4 py-3 text-xs text-gray-10">
                No signal is clearly significant yet — every effect below is still within noise. Patterns firm up as more nights and sessions accumulate.
              </p>
            )}
            {strong.map((e, i) => <DriverRow key={e.driver} e={e} i={i} />)}
          </div>

          {weak.length > 0 && (
            <details className="group rounded-lg border border-gray-6 bg-gray-2">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-xs text-gray-11">Weaker signals ({weak.length}) — not yet distinguishable from noise</summary>
              <div className="flex flex-col gap-2 p-3 pt-0">
                {weak.map((e, i) => <DriverRow key={e.driver} e={e} i={i} />)}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function DriverRow({ e, i }: { e: DriverEffect; i: number }) {
  const def = METRICS[e.driver];
  const max = 8; // ±8 percentage points fills the bar
  const w = Math.min(100, (Math.abs(e.spread) / max) * 100);
  const helps = e.favorable == null ? null : e.favorable > 0;
  const Icon = def.category === 'behavior' || def.category === 'sleep' ? Moon : Activity;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
      className="flex flex-col gap-2 rounded-xl border border-gray-6 bg-gray-2 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: def.color }} />
          <span className="text-sm font-medium text-gray-12">{e.lag === 1 ? `Yesterday's ${def.label.toLowerCase()}` : def.label}</span>
          <span className={clsx('rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase', CONF_STYLE[e.confidence])}>{e.confidence}</span>
        </div>
        <span className="text-[10px] text-gray-10">ρ {e.rho >= 0 ? '+' : ''}{e.rho.toFixed(2)} · n={e.n}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
        <div className="text-right text-gray-11">
          <div>≤ {fmtMetric(e.driver, e.lowMax)}</div>
          <div className="font-semibold" style={{ color: e.lowMean >= 0 ? '#10b981' : '#f97316' }}>{pct(e.lowMean)}</div>
        </div>
        <div className="relative h-2 w-28 rounded-full bg-gray-4 sm:w-48">
          <div className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-gray-8" />
          <div className="absolute top-0 h-2 rounded-full"
            style={{
              background: helps == null ? def.color : helps ? '#10b981' : '#f97316',
              width: `${w / 2}%`, left: e.spread >= 0 ? '50%' : `${50 - w / 2}%`,
            }} />
        </div>
        <div className="text-gray-11">
          <div>≥ {fmtMetric(e.driver, e.highMin)}</div>
          <div className="font-semibold" style={{ color: e.highMean >= 0 ? '#10b981' : '#f97316' }}>{pct(e.highMean)}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-gray-10">
        {e.spread >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        Top-third vs bottom-third {def.short.toLowerCase()}: {e.spread >= 0 ? '+' : '−'}{Math.abs(e.spread).toFixed(1)} pts session performance
        {helps === false && <span className="text-orange-400">· counter-intuitive — treat with caution</span>}
      </div>
    </motion.div>
  );
}
