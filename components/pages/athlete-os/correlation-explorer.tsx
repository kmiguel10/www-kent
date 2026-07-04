import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

import type { DailyMatrix, LagDays, MetricKey, RollingWindow } from '@/lib/athlete-os/types';
import { LAG_OPTIONS, WINDOW_OPTIONS } from '@/lib/athlete-os/types';
import { ANALYSIS_METRIC_KEYS, METRICS } from '@/lib/athlete-os/metrics/registry';
import { analyzePair } from '@/lib/athlete-os/services/correlation/correlationEngine';

/**
 * Correlation Explorer — pick any two metrics and see the scatter, a fitted
 * trend line, and a confidence-scored coefficient at a chosen lag / window.
 * Uses recharts (the house charting lib) — a ScatterChart plus a ReferenceLine
 * regression line covers the requirement with zero new dependencies.
 */

const CONF_COLOR = { high: '#10b981', moderate: '#eab308', low: '#f97316', insufficient: '#6b7280' } as const;

function MetricSelect({
  value, onChange, label, exclude,
}: { value: MetricKey; onChange: (k: MetricKey) => void; label: string; exclude?: MetricKey }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-10">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MetricKey)}
        className="rounded-md border border-gray-6 bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none focus:border-gray-8"
      >
        {ANALYSIS_METRIC_KEYS.filter((k) => k !== exclude).map((k) => (
          <option key={k} value={k}>{METRICS[k].label}</option>
        ))}
      </select>
    </label>
  );
}

export default function CorrelationExplorer({ matrix }: { matrix: DailyMatrix }) {
  // Default to two metrics with deep shared history (both Garmin) so the first
  // view is a populated scatter; WHOOP-sourced metrics are still selectable but
  // only have a few days of overlap so far.
  const [x, setX] = useState<MetricKey>('sleepScore');
  const [y, setY] = useState<MetricKey>('trainingReadiness');
  const [window, setWindow] = useState<RollingWindow>(90);
  const [lag, setLag] = useState<LagDays | 'auto'>('auto');
  const [method, setMethod] = useState<'pearson' | 'spearman'>('pearson');

  const result = useMemo(
    () => analyzePair(matrix, x, y, { method, window, lag }),
    [matrix, x, y, method, window, lag],
  );

  // Least-squares line for the current pairs → two endpoints for a ReferenceLine.
  const trend = useMemo(() => {
    const pts = result.pairs;
    if (pts.length < 2) return null;
    const n = pts.length;
    const sx = pts.reduce((s, p) => s + p.x, 0);
    const sy = pts.reduce((s, p) => s + p.y, 0);
    const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
    const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    const xs = pts.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ];
  }, [result.pairs]);

  const xMeta = METRICS[x];
  const yMeta = METRICS[y];
  const confColor = CONF_COLOR[result.confidence.level];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <MetricSelect label="X axis" value={x} onChange={setX} exclude={y} />
        <MetricSelect label="Y axis" value={y} onChange={setY} exclude={x} />
        <Segmented
          label="Lag"
          options={['auto', ...LAG_OPTIONS] as (LagDays | 'auto')[]}
          value={lag}
          onChange={setLag}
          fmt={(v) => (v === 'auto' ? 'Auto' : v === 0 ? '0d' : `${v}d`)}
        />
        <Segmented
          label="Window"
          options={WINDOW_OPTIONS}
          value={window}
          onChange={setWindow}
          fmt={(v) => (v === 0 ? 'All' : `${v}d`)}
        />
        <Segmented
          label="Method"
          options={['pearson', 'spearman'] as const}
          value={method}
          onChange={setMethod}
          fmt={(v) => (v === 'pearson' ? 'Pearson' : 'Spearman')}
        />
      </div>

      {/* Result banner */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-6 bg-gray-2 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-10">Correlation</span>
          <span className="text-2xl font-semibold tabular-nums" style={{ color: confColor }}>
            {result.correlation >= 0 ? '+' : ''}{result.correlation.toFixed(2)}
          </span>
        </div>
        <Divider />
        <Field label="Best lag" value={result.lagDays === 0 ? 'same day' : `${result.lagDays} day${result.lagDays > 1 ? 's' : ''}`} />
        <Field label="Confidence" value={result.confidence.level} valueColor={confColor} />
        <Field label="Sample" value={`${result.sampleSize} days`} />
        <Field label="Completeness" value={`${Math.round(result.confidence.completeness * 100)}%`} />
      </div>

      {/* Scatter */}
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
          <XAxis
            type="number" dataKey="x" name={xMeta.label}
            tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={{ stroke: 'var(--gray-6)' }}
            label={{ value: `${xMeta.label}${xMeta.unit ? ` (${xMeta.unit})` : ''}`, position: 'bottom', fill: 'var(--gray-10)', fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="y" name={yMeta.label}
            tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={{ stroke: 'var(--gray-6)' }}
            width={44}
            label={{ value: yMeta.unit || '', angle: -90, position: 'insideLeft', fill: 'var(--gray-10)', fontSize: 11 }}
          />
          <ZAxis range={[36, 36]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'var(--gray-7)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { x: number; y: number; date: string };
              return (
                <div className="rounded border border-gray-6 bg-gray-2 px-3 py-2 text-xs shadow-md">
                  <div className="mb-1 font-medium text-gray-12">{p.date}</div>
                  <div className="text-gray-11">{xMeta.short}: <span className="text-gray-12">{p.x.toFixed(1)}</span></div>
                  <div className="text-gray-11">{yMeta.short}: <span className="text-gray-12">{p.y.toFixed(1)}</span></div>
                </div>
              );
            }}
          />
          {trend && (
            <ReferenceLine
              ifOverflow="extendDomain"
              stroke={confColor}
              strokeWidth={2}
              strokeDasharray="5 4"
              segment={trend}
            />
          )}
          <Scatter data={result.pairs} fill={yMeta.color} fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>

      {result.sampleSize < 8 && (
        <p className="text-xs text-gray-10">
          Only {result.sampleSize} overlapping days in this window — treat the coefficient as directional until more data accrues.
        </p>
      )}
    </div>
  );
}

function Segmented<T extends string | number>({
  label, options, value, onChange, fmt,
}: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; fmt: (v: T) => string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-10">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-gray-6">
        {options.map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            className={clsx(
              'px-2.5 py-1.5 text-xs font-medium transition-colors',
              value === opt ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3',
            )}
          >
            {fmt(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-sm font-medium capitalize" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-gray-6" />;
}
