import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

import type { PlanPayload } from '@/pages/api/athlete-os/plan';
import { fmtDay } from './plan-ui';

/**
 * Training load (Garmin training load, all sports) — fitness (42-day) and
 * fatigue (7-day) with the plan projected to race day. This is mechanical load
 * arithmetic, not a finish-time prediction: the athlete's history shows no
 * credible load→performance link to model (confounded by summer heat).
 */
export default function TrainingLoad({ plan }: { plan: PlanPayload }) {
  const { history, fullPlan, atAdherence, adherence, loadPerKm } = plan.load;
  const hist = history.slice(-90);
  const rows: { date: string; fitness?: number; fatigue?: number; planFitness?: number; planFatigue?: number; adhFitness?: number }[] = [
    ...hist.map((p) => ({ date: p.date, fitness: p.ctl, fatigue: p.atl })),
    ...fullPlan.map((p, i) => ({ date: p.date, planFitness: p.ctl, planFatigue: p.atl, adhFitness: atAdherence[i]?.ctl })),
  ];
  // Connect the projection lines to "today".
  if (hist.length && rows[hist.length - 1]) {
    const last = rows[hist.length - 1];
    last.planFitness = last.fitness; last.planFatigue = last.fatigue; last.adhFitness = last.fitness;
  }

  const now = hist.at(-1);
  const raceFull = fullPlan.at(-1);
  const raceAdh = atAdherence.at(-1);
  const peak = fullPlan.reduce<typeof fullPlan[number] | null>((m, p) => (!m || p.ctl > m.ctl ? p : m), null);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Fitness now" value={now ? Math.round(now.ctl).toString() : '—'} sub="42-day load" />
        <Tile label="Form now" value={now ? signed(now.tsb) : '—'} sub="fitness − fatigue" color={now ? formColor(now.tsb) : undefined} />
        <Tile label="Race-day form · full plan" value={raceFull ? signed(raceFull.tsb) : '—'} sub={peak ? `fitness peaks ${Math.round(peak.ctl)} on ${fmtDay(peak.date, { month: 'short', day: 'numeric' })}` : ''} color={raceFull ? formColor(raceFull.tsb) : undefined} />
        <Tile label="Race-day fitness" value={raceFull ? `${Math.round(raceFull.ctl)}` : '—'}
          sub={raceAdh && adherence != null ? `${Math.round(raceAdh.ctl)} at ${Math.round(adherence * 100)}% adherence` : 'adherence needs a full plan week'} />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-5)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => fmtDay(d, { month: 'short', day: 'numeric' })} tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} minTickGap={30} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--gray-10)' }} tickLine={false} axisLine={false} width={40} />
          <ReferenceLine x={plan.today} stroke="var(--gray-8)" strokeDasharray="2 3" label={{ value: 'today', fill: 'var(--gray-10)', fontSize: 10, position: 'insideTopLeft' }} />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded border border-gray-6 bg-gray-2 px-2.5 py-1.5 text-xs text-gray-12">
                <div className="font-medium">{fmtDay(String(label))}</div>
                {payload.filter((p) => p.value != null).map((p) => (
                  <div key={String(p.dataKey)} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}: {Math.round(Number(p.value))}</div>
                ))}
              </div>
            );
          }} />
          <Line dataKey="fitness" name="Fitness" stroke="#0ea5e9" strokeWidth={2} dot={false} />
          <Line dataKey="fatigue" name="Fatigue" stroke="#f472b6" strokeWidth={1.5} dot={false} />
          <Line dataKey="planFitness" name="Fitness · full plan" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          <Line dataKey="planFatigue" name="Fatigue · full plan" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
          {atAdherence.length > 0 && <Line dataKey="adhFitness" name="Fitness · current adherence" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="2 3" dot={false} />}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-10">
        Garmin training load across all sports. Solid = history, dashed = Runna plan projected to race day ({loadPerKm != null ? `${loadPerKm} load per planned km, your recent median` : 'your recent load per km'}; other activity continues at its recent average).
        Grey = the same plan at your current adherence. Positive form on race day means you arrive fresh. This is load arithmetic, not a finish-time prediction.
      </p>
    </div>
  );
}

const signed = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}`;
const formColor = (tsb: number) => (tsb >= 5 ? '#10b981' : tsb >= -10 ? '#eab308' : '#f97316');

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-6 bg-gray-2 p-3">
      <span className="text-[10px] uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-xl font-semibold text-gray-12" style={color ? { color } : undefined}>{value}</span>
      {sub && <span className="text-[10px] text-gray-10">{sub}</span>}
    </div>
  );
}
