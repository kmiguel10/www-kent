import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine,
} from 'recharts';
import { AlertTriangle, TrendingUp, Info, Check } from 'lucide-react';

import type { AerobicModel } from '@/lib/athlete-os/services/aerobic/aerobicAnalysis';
import { decouplingAvailable } from '@/lib/athlete-os/services/aerobic/aerobicAnalysis';

/**
 * AerobicView — renders a sport-agnostic AerobicModel (cycling or running).
 * Both sports derive zones from the athlete's own HR–intensity history, so the
 * same component visualises either one.
 */

const CONF_COLOR = { high: '#10b981', moderate: '#eab308', low: '#f97316' } as const;

export default function AerobicView({ model }: { model: AerobicModel | null }) {
  if (!model) {
    return <div className="p-8 text-center text-sm text-gray-11">Not enough HR + {`${'intensity'}`} data yet to derive zones for this sport.</div>;
  }

  const xs = model.scatter.map((s) => s.x);
  const ys = model.scatter.map((s) => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  // Scale-proportional padding so both the power (~80–150) and speed (~1.5–3.3)
  // axes get sensible bounds and tick labels.
  const padX = (maxX - minX) * 0.08 || 1;
  const padY = (maxY - minY) * 0.08 || 1;
  const xDomain: [number, number] = [minX - padX, maxX + padX];
  const yDomain: [number, number] = [minY - padY, maxY + padY];
  const line = [
    { x: minX, y: model.fit.a + model.fit.b * minX },
    { x: maxX, y: model.fit.a + model.fit.b * maxX },
  ];

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Headline */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-6 bg-gray-2 px-4 py-3">
        <Stat label={model.anchorLabel} value={model.anchorValue} sub={model.anchorSub} />
        <Divider />
        <Stat label="True Zone 2" value={model.z2HrText} sub={model.z2IntensityText} color="#34d399" />
        <Divider />
        <Stat label="Threshold HR" value={model.thresholdHr ? `${model.thresholdHr} bpm` : '—'} sub={model.thresholdHrSub} />
        <Divider />
        <Stat label="Confidence" value={model.confidence} sub={`${model.sampleN} sessions`} color={CONF_COLOR[model.confidence]} />
      </div>

      {/* Recommendations */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Recommendations · derived from your data</SectionLabel>
        <div className="flex flex-col gap-2">
          {model.recs.map((r, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-gray-6 bg-gray-2 p-3">
              <div className="mt-0.5 shrink-0" style={{ color: r.severity === 'action' ? '#f97316' : r.severity === 'good' ? '#10b981' : '#0090FF' }}>
                {r.severity === 'action' ? <AlertTriangle size={16} /> : r.severity === 'good' ? <Check size={16} /> : <Info size={16} />}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-12">{r.title}</span>
                <span className="text-sm text-gray-11">{r.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HR–intensity scatter */}
      <div className="flex flex-col gap-2">
        <SectionLabel>HR vs {model.sport === 'cycling' ? 'Power' : 'Speed'} · {model.scatter.length} sessions · green band = your derived Zone 2</SectionLabel>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
            {model.z2BandX && <ReferenceArea x1={model.z2BandX[0]} x2={model.z2BandX[1]} fill="#34d399" fillOpacity={0.12} />}
            <XAxis type="number" dataKey="x" name="intensity" domain={xDomain} allowDecimals={model.sport === 'running'}
              tickFormatter={(v) => model.xTickFormat(Number(v))}
              tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={{ stroke: 'var(--gray-6)' }}
              label={{ value: model.xLabel, position: 'bottom', fill: 'var(--gray-10)', fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="HR" domain={yDomain} width={40} allowDecimals={false}
              tickFormatter={(v) => `${Math.round(Number(v))}`}
              tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={{ stroke: 'var(--gray-6)' }} />
            <ZAxis range={[30, 30]} />
            {model.thresholdHr && <ReferenceLine y={model.thresholdHr} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Threshold', fill: '#f43f5e', fontSize: 10, position: 'insideTopRight' }} />}
            {model.z2CeilingHr && <ReferenceLine y={model.z2CeilingHr} stroke="#34d399" strokeDasharray="4 4" label={{ value: 'Z2 ceiling', fill: '#34d399', fontSize: 10, position: 'insideTopRight' }} />}
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { x: number; y: number };
              return <div className="rounded border border-gray-6 bg-gray-2 px-2 py-1 text-xs text-gray-12">{model.formatX(p.x)} · {p.y} bpm</div>;
            }} />
            <Scatter data={model.scatter} fill="#0090FF" fillOpacity={0.6} />
            <Scatter data={line} line={{ stroke: '#eab308', strokeWidth: 2 }} shape={() => <g />} legendType="none" />
          </ScatterChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-10">Fit: {model.fitLabel}. Yellow line = your HR–intensity relationship; green band = derived Zone 2.</p>
      </div>

      {/* Zones table */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Recommended {model.sport} zones</SectionLabel>
        <div className="overflow-hidden rounded-lg border border-gray-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-2 text-gray-10">
              <tr><th className="px-3 py-2 text-left font-medium">Zone</th><th className="px-3 py-2 text-right font-medium">Heart rate</th><th className="px-3 py-2 text-right font-medium">{model.sport === 'cycling' ? 'Power' : 'Pace'}</th></tr>
            </thead>
            <tbody>
              {model.zoneRows.map((r) => (
                <tr key={r.zone} className="border-t border-gray-6">
                  <td className="px-3 py-2 text-gray-12">{r.zone}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">{r.hr}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">{r.intensity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trends */}
      <div className="grid gap-4 md:grid-cols-2">
        <TrendCard title={model.efLabel} delta={model.efChangePct} data={model.efPts} color="#34d399" />
        <TrendCard title={model.secondTrend.label} delta={null} data={model.secondTrend.pts} color="#a855f7"
          unit={model.secondTrend.unit} reversed={model.secondTrend.reversed} format={model.secondTrend.format} />
      </div>

      {/* Audit */}
      <div className="flex flex-col gap-2">
        <SectionLabel>{model.auditTitle}</SectionLabel>
        <div className="overflow-x-auto rounded-lg border border-gray-6">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-gray-2 text-gray-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Workout</th>
                <th className="px-3 py-2 text-left font-medium">Intended</th>
                <th className="px-3 py-2 text-right font-medium">Avg/Max HR</th>
                <th className="px-3 py-2 text-right font-medium">{model.auditIntensityLabel}</th>
                <th className="px-3 py-2 text-left font-medium">Actual zone</th>
              </tr>
            </thead>
            <tbody>
              {model.audit.slice(0, 12).map((a, i) => (
                <tr key={i} className="border-t border-gray-6">
                  <td className="px-3 py-2 text-gray-11">{a.date.slice(5)}</td>
                  <td className="px-3 py-2 text-gray-12">{a.name}</td>
                  <td className="px-3 py-2 text-gray-11">{a.intended === 'easy' ? 'Easy/Z2' : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">{a.avgHr}/{a.maxHr}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">{a.intensity}</td>
                  <td className="px-3 py-2"><span className={a.flagged ? 'font-medium text-red-400' : 'text-gray-11'}>{a.actualZone}{a.flagged ? '  ⚠' : ''}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-10">⚠ = labelled easy but {'>'}50% of time was above Zone 2 (tempo/threshold).</p>
      </div>

      {!decouplingAvailable && (
        <div className="rounded-lg border border-dashed border-gray-6 bg-gray-2 px-4 py-3 text-xs text-gray-10">
          <span className="font-medium text-gray-11">Aerobic decoupling & HR drift — pending.</span> True first-half vs second-half drift
          needs per-second streams, which aren't stored yet. A Strava stream-ingestion pipeline is the next step to unlock it.
        </div>
      )}
    </div>
  );
}

function TrendCard({ title, delta, data, color, unit, reversed, format }: { title: string; delta: number | null; data: { date: string; v: number }[]; color: string; unit?: string; reversed?: boolean; format?: (v: number) => string }) {
  const fmt = (v: number) => (format ? format(v) : `${v}${unit ?? ''}`);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-6 bg-gray-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-11">{title}</span>
        {delta != null && (
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: delta >= 0 ? '#10b981' : '#f43f5e' }}>
            <TrendingUp size={12} />{delta >= 0 ? '+' : ''}{Math.round(delta)}%
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
          <YAxis domain={['dataMin', 'dataMax']} reversed={reversed} tickFormatter={format ? (v) => format(Number(v)) : undefined}
            tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} width={format ? 48 : 40} unit={format ? undefined : unit} />
          <XAxis dataKey="date" hide />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="rounded border border-gray-6 bg-gray-2 px-2 py-1 text-xs text-gray-12">{(payload[0].payload as { date: string }).date}: {fmt(Number(payload[0].value))}</div> : null} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-lg font-semibold capitalize" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="text-[10px] text-gray-10">{sub}</span>}
    </div>
  );
}
function Divider() { return <div className="h-9 w-px bg-gray-6" />; }
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">{children}</span>;
}
