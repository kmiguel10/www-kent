import { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

import type { DailyMatrix, MetricKey } from '@/lib/athlete-os/types';
import { METRICS } from '@/lib/athlete-os/metrics/registry';
import { computeDrivers } from '@/lib/athlete-os/services/performance/drivers';
import { fmtClock, fmtMetric, fmtMinutes } from '@/lib/athlete-os/format';

/**
 * Sleep & habits — WHOOP-derived behaviors (bedtime, regularity, time in bed,
 * sleep debt, steps) and how each one moves next-morning WHOOP recovery.
 */

const HABITS: MetricKey[] = ['bedtime', 'bedtimeShift', 'timeInBed', 'sleepDebt3d', 'sleepConsistency', 'steps'];
const NIGHTS = 30;

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);

export default function SleepHabits({ matrix }: { matrix: DailyMatrix }) {
  const idx = matrix.dates.map((_, i) => i).slice(-NIGHTS);
  const chart = idx.map((i) => ({
    label: new Date(matrix.dates[i] + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    sleepH: matrix.series.sleepDuration[i] != null ? +(matrix.series.sleepDuration[i]! / 60).toFixed(2) : null,
    bedtime: matrix.series.bedtime[i],
    recovery: matrix.series.recovery[i],
  })).filter((r) => r.sleepH != null || r.bedtime != null);

  const last14 = (k: MetricKey) => mean(matrix.series[k].slice(-14).filter((v): v is number => v != null));
  const debt7 = matrix.series.sleepDebt.slice(-7).filter((v): v is number => v != null).reduce((s, v) => s + v, 0);

  // How each habit moves next-morning recovery (same night → that morning's score).
  const effects = useMemo(() => computeDrivers(matrix, ['recovery'], HABITS), [matrix]);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Avg bedtime · 14 nights" value={last14('bedtime') != null ? fmtClock(last14('bedtime')!) : '—'} />
        <Stat label="Bedtime irregularity" value={fmtMetric('bedtimeShift', last14('bedtimeShift'))} sub="vs your typical" />
        <Stat label="Sleep debt · 7 nights" value={fmtMinutes(debt7)} sub={debt7 > 0 ? 'behind your need' : 'ahead of your need'}
          color={debt7 > 120 ? '#f97316' : debt7 > 0 ? '#eab308' : '#10b981'} />
        <Stat label="Avg steps · 14 days" value={fmtMetric('steps', last14('steps'))} />
      </div>

      <div className="rounded-xl border border-gray-6 bg-gray-2 p-3">
        <div className="mb-1 text-xs font-medium text-gray-11">Last {NIGHTS} nights · sleep (bars) and bedtime (line)</div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chart} margin={{ top: 6, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis yAxisId="h" domain={[0, 10]} tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} unit="h" width={34} />
            <YAxis yAxisId="bt" orientation="right" reversed domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v) => fmtClock(Number(v))}
              tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} width={58} />
            <ReferenceLine yAxisId="h" y={8} stroke="var(--gray-8)" strokeDasharray="3 3" />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as typeof chart[number];
              return (
                <div className="rounded border border-gray-6 bg-gray-2 px-2 py-1.5 text-xs text-gray-12">
                  <div className="font-medium">{label}</div>
                  {p.sleepH != null && <div>Slept {fmtMinutes(p.sleepH * 60)}</div>}
                  {p.bedtime != null && <div>Asleep at {fmtClock(p.bedtime)}</div>}
                  {p.recovery != null && <div>Recovery {Math.round(p.recovery)}%</div>}
                </div>
              );
            }} />
            <Bar yAxisId="h" dataKey="sleepH" fill="#38bdf8" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
            <Line yAxisId="bt" type="monotone" dataKey="bedtime" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">How your habits move next-morning recovery</span>
        {effects.length === 0 && <p className="text-xs text-gray-10">Need ~10 nights with both values to estimate this.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {effects.map((e) => {
            const def = METRICS[e.driver];
            const good = e.favorable == null ? null : e.favorable > 0;
            return (
              <div key={e.driver} className="flex flex-col gap-1 rounded-xl border border-gray-6 bg-gray-2 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-12">{def.label}</span>
                  <span className="text-[10px] text-gray-10">{e.confidence} · n={e.n}</span>
                </div>
                <div className="text-gray-11">
                  ≤ {fmtMetric(e.driver, e.lowMax)}: <span className="font-semibold text-gray-12">{Math.round(e.lowMean)}%</span> recovery
                  {'  ·  '}≥ {fmtMetric(e.driver, e.highMin)}: <span className="font-semibold text-gray-12">{Math.round(e.highMean)}%</span>
                </div>
                <div style={{ color: good == null ? 'var(--gray-10)' : good ? '#10b981' : '#f97316' }}>
                  {e.spread >= 0 ? '+' : '−'}{Math.abs(Math.round(e.spread))} recovery points from the high end
                  {good === false && e.confidence !== 'low' && <span className="text-gray-10"> · counter-intuitive — likely confounded</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-10">
          Habits are derived from WHOOP sleep timing and day cycles (WHOOP's API doesn't expose Journal entries). Bottom vs top third of your own nights.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-3">
      <span className="text-[10px] uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-xl font-semibold text-gray-12" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="text-[10px] text-gray-10">{sub}</span>}
    </div>
  );
}
