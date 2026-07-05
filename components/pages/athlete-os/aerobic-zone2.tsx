import { useMemo } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine,
} from 'recharts';
import { AlertTriangle, TrendingUp, Info, Check } from 'lucide-react';

import {
  type RideSummary,
  deriveCyclingZones, efSeries, ftpTrend, zwiftAudit, indoorVsOutdoor, generateRecommendations,
  decouplingAvailable,
} from '@/lib/athlete-os/services/aerobic/aerobicAnalysis';

/**
 * Aerobic / Zone 2 — derives cycling zones from the athlete's own HR–power
 * history (not % formulas), audits Zwift "easy" rides against physiological
 * response, and generates evidence-based recommendations.
 */

const CONF_COLOR = { high: '#10b981', moderate: '#eab308', low: '#f97316' } as const;

export default function AerobicZone2({ rides }: { rides: RideSummary[] }) {
  const zones = useMemo(() => deriveCyclingZones(rides), [rides]);
  const ef = useMemo(() => efSeries(rides), [rides]);
  const ftpT = useMemo(() => ftpTrend(rides), [rides]);
  const audit = useMemo(() => zwiftAudit(rides), [rides]);
  const io = useMemo(() => indoorVsOutdoor(rides), [rides]);
  const recs = useMemo(() => generateRecommendations(zones, ef, audit, io), [zones, ef, audit, io]);

  const z2 = zones.rows.find((r) => r.zone.startsWith('Z2'));
  const powerRides = rides.filter((r) => r.normPower && r.avgHr).length;

  if (!zones.ftp || !zones.fit) {
    return <div className="p-8 text-center text-sm text-gray-11">Not enough power+HR ride data yet to derive zones.</div>;
  }

  // Scatter of NP vs avg HR + regression line endpoints.
  const scatter = ef.pts.map((p) => ({ x: p.np, y: p.hr }));
  const xs = scatter.map((s) => s.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const line = [
    { x: minX, y: zones.fit.a + zones.fit.b * minX },
    { x: maxX, y: zones.fit.a + zones.fit.b * maxX },
  ];

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Headline */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-6 bg-gray-2 px-4 py-3">
        <Stat label="Est. FTP" value={`${zones.ftp} W`} sub={`best 20-min ${zones.best20}W`} />
        <Divider />
        <Stat label="True Zone 2" value={z2 ? `${z2.hrLow}–${z2.hrHigh} bpm` : '—'} sub={z2 ? `${z2.powerLow}–${z2.powerHigh} W` : ''} color="#34d399" />
        <Divider />
        <Stat label="Threshold HR" value={`${zones.thresholdHr} bpm`} sub="at FTP" />
        <Divider />
        <Stat label="Confidence" value={zones.confidence} sub={`${zones.fit.n} power rides`} color={CONF_COLOR[zones.confidence]} />
      </div>

      {/* Recommendations */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Recommendations · derived from your data</SectionLabel>
        <div className="flex flex-col gap-2">
          {recs.map((r, i) => (
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

      {/* HR–Power scatter */}
      <div className="flex flex-col gap-2">
        <SectionLabel>HR vs Power · {powerRides} rides · the Z2 band is your derived aerobic window</SectionLabel>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" />
            {z2?.powerLow != null && z2.powerHigh != null && (
              <ReferenceArea x1={z2.powerLow} x2={z2.powerHigh} fill="#34d399" fillOpacity={0.12} />
            )}
            <XAxis type="number" dataKey="x" name="Power" domain={['dataMin - 10', 'dataMax + 10']}
              tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={{ stroke: 'var(--gray-6)' }}
              label={{ value: 'Normalized Power (W)', position: 'bottom', fill: 'var(--gray-10)', fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="HR" domain={['dataMin - 5', 'dataMax + 5']} width={40}
              tick={{ fontSize: 11, fill: 'var(--gray-11)' }} tickLine={false} axisLine={{ stroke: 'var(--gray-6)' }} />
            <ZAxis range={[30, 30]} />
            {zones.thresholdHr && <ReferenceLine y={zones.thresholdHr} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Threshold', fill: '#f43f5e', fontSize: 10, position: 'insideTopRight' }} />}
            {z2?.hrHigh && <ReferenceLine y={z2.hrHigh} stroke="#34d399" strokeDasharray="4 4" label={{ value: 'Z2 ceiling', fill: '#34d399', fontSize: 10, position: 'insideTopRight' }} />}
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { x: number; y: number };
              return <div className="rounded border border-gray-6 bg-gray-2 px-2 py-1 text-xs text-gray-12">{p.x} W · {p.y} bpm</div>;
            }} />
            <Scatter data={scatter} fill="#0090FF" fillOpacity={0.7} />
            <Scatter data={line} line={{ stroke: '#eab308', strokeWidth: 2 }} shape={() => <g />} legendType="none" />
          </ScatterChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-10">Fit: HR ≈ {Math.round(zones.fit.a)} + {zones.fit.b.toFixed(2)}·W. Yellow line = your HR–power relationship; green band = derived Zone 2.</p>
      </div>

      {/* Zones table */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Recommended cycling zones</SectionLabel>
        <div className="overflow-hidden rounded-lg border border-gray-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-2 text-gray-10">
              <tr><th className="px-3 py-2 text-left font-medium">Zone</th><th className="px-3 py-2 text-right font-medium">Heart rate</th><th className="px-3 py-2 text-right font-medium">Power</th></tr>
            </thead>
            <tbody>
              {zones.rows.map((r) => (
                <tr key={r.zone} className="border-t border-gray-6">
                  <td className="px-3 py-2 text-gray-12">{r.zone}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">
                    {r.hrLow == null ? `< ${r.hrHigh}` : r.hrHigh == null ? `${r.hrLow}+` : `${r.hrLow}–${r.hrHigh}`} bpm
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">
                    {r.powerLow == null ? `< ${r.powerHigh}` : r.powerHigh == null ? `${r.powerLow}+` : `${r.powerLow}–${r.powerHigh}`} W
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EF + FTP trends */}
      <div className="grid gap-4 md:grid-cols-2">
        <TrendCard title="Aerobic efficiency (NP/HR)" delta={ef.changePct} data={ef.pts.map((p) => ({ date: p.date, v: +p.ef.toFixed(3) }))} color="#34d399" />
        <TrendCard title="FTP proxy (best 20-min × 0.95)" delta={null} data={ftpT.map((p) => ({ date: p.date, v: p.w }))} color="#a855f7" unit="W" />
      </div>

      {/* Zwift audit */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Zwift audit · is your "easy" actually easy?</SectionLabel>
        <div className="overflow-x-auto rounded-lg border border-gray-6">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-gray-2 text-gray-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Workout</th>
                <th className="px-3 py-2 text-left font-medium">Intended</th>
                <th className="px-3 py-2 text-right font-medium">Avg/Max HR</th>
                <th className="px-3 py-2 text-right font-medium">NP</th>
                <th className="px-3 py-2 text-left font-medium">Actual zone</th>
              </tr>
            </thead>
            <tbody>
              {audit.slice(0, 12).map((a, i) => (
                <tr key={i} className="border-t border-gray-6">
                  <td className="px-3 py-2 text-gray-11">{a.date.slice(5)}</td>
                  <td className="px-3 py-2 text-gray-12">{a.name.replace(/^Zwift - /, '')}</td>
                  <td className="px-3 py-2 text-gray-11">{a.intended === 'easy' ? 'Easy/Z2' : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">{a.avgHr}/{a.maxHr}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-11">{a.normPower ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={a.flagged ? 'font-medium text-red-400' : 'text-gray-11'}>
                      {a.actualZone}{a.flagged ? '  ⚠' : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-10">⚠ = labelled easy but {'>'}50% of time was above Zone 2 (tempo/threshold).</p>
      </div>

      {/* Decoupling pending */}
      {!decouplingAvailable && (
        <div className="rounded-lg border border-dashed border-gray-6 bg-gray-2 px-4 py-3 text-xs text-gray-10">
          <span className="font-medium text-gray-11">Aerobic decoupling & HR drift — pending.</span> True first-half vs second-half Pw:Hr
          drift needs per-second streams, which aren't stored yet. A Strava stream-ingestion pipeline is the next step to unlock it.
        </div>
      )}
    </div>
  );
}

function TrendCard({ title, delta, data, color, unit }: { title: string; delta: number | null; data: { date: string; v: number }[]; color: string; unit?: string }) {
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
        <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -24 }}>
          <YAxis domain={['dataMin', 'dataMax']} tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} width={36} unit={unit} />
          <XAxis dataKey="date" hide />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="rounded border border-gray-6 bg-gray-2 px-2 py-1 text-xs text-gray-12">{(payload[0].payload as { date: string }).date}: {payload[0].value}{unit ?? ''}</div> : null} />
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
