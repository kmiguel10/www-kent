import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import clsx from 'clsx';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import type { FitnessActivity } from '@/pages/fitness';

type Unit = 'km' | 'mi';
type Tab = 'week' | 'month';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UTC_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const WEEK_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Matches the area chart's existing blue
const COLOR_CURRENT  = '#0090FF';
const COLOR_PREVIOUS = '#60646c';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeriodStats {
  activities: number;
  distanceKm: number;
  durationHours: number;
  calories: number;
}

interface ChartPoint {
  label: string;
  current: number | null; // null for days after today (stops the line)
  previous: number | null;
}

interface Insights {
  currentWeek: PeriodStats;
  lastWeekSameDays: PeriodStats;
  currentMonth: PeriodStats;
  lastMonthSameDays: PeriodStats;
  weeklyChart: ChartPoint[];
  monthlyChart: ChartPoint[];
  monthName: string;
  lastMonthName: string;
  daysIntoWeek: number;
  dayOfMonth: number;
  daysInLastMonth: number;
  insight: string;
}

// ---------------------------------------------------------------------------
// Computation (runs client-side from filtered activities prop)
// ---------------------------------------------------------------------------

const EMPTY: PeriodStats = { activities: 0, distanceKm: 0, durationHours: 0, calories: 0 };

function aggregate(rows: FitnessActivity[]): PeriodStats {
  return rows.reduce<PeriodStats>(
    (acc, a) => ({
      activities: acc.activities + 1,
      distanceKm: acc.distanceKm + (a.distance_meters ?? 0) / 1000,
      durationHours: acc.durationHours + (a.duration_seconds ?? 0) / 3600,
      calories: acc.calories + (a.calories ?? 0),
    }),
    { ...EMPTY },
  );
}

function inRange(a: FitnessActivity, start: Date, end: Date) {
  const t = new Date(a.start_time);
  return t >= start && t < end;
}

function dayDistKm(buckets: Record<string, FitnessActivity[]>, dateStr: string): number {
  return (buckets[dateStr] ?? []).reduce((s, a) => s + (a.distance_meters ?? 0) / 1000, 0);
}

function bucketByDate(activities: FitnessActivity[]): Record<string, FitnessActivity[]> {
  const map: Record<string, FitnessActivity[]> = {};
  for (const a of activities) {
    const key = new Date(a.start_time).toISOString().slice(0, 10);
    (map[key] ??= []).push(a);
  }
  return map;
}

function generateInsight(
  cw: PeriodStats, lwSame: PeriodStats,
  cm: PeriodStats, lmSame: PeriodStats,
  monthName: string, lastMonthName: string,
  daysIntoWeek: number, dayOfMonth: number,
): string {
  const weekPct = lwSame.distanceKm > 0
    ? Math.round(((cw.distanceKm - lwSame.distanceKm) / lwSame.distanceKm) * 100) : null;
  const monthPct = lmSame.distanceKm > 0
    ? Math.round(((cm.distanceKm - lmSame.distanceKm) / lmSame.distanceKm) * 100) : null;

  let week: string;
  if (cw.activities === 0) {
    week = 'No sessions logged yet this week.';
  } else if (weekPct === null) {
    week = `${cw.distanceKm.toFixed(1)} km across ${cw.activities} sessions this week.`;
  } else if (weekPct >= 20) {
    week = `You're ${weekPct}% ahead of last week through the same ${daysIntoWeek} days — ${cw.distanceKm.toFixed(1)} km vs ${lwSame.distanceKm.toFixed(1)} km.`;
  } else if (weekPct >= 5) {
    week = `Slightly ahead of last week's pace — ${cw.distanceKm.toFixed(1)} km vs ${lwSame.distanceKm.toFixed(1)} km through ${daysIntoWeek} days (+${weekPct}%).`;
  } else if (weekPct <= -20) {
    week = `${Math.abs(weekPct)}% behind last week's pace through ${daysIntoWeek} days — lighter load or a recovery week.`;
  } else if (weekPct <= -5) {
    week = `Slightly behind last week's pace at the same point (${cw.distanceKm.toFixed(1)} km vs ${lwSame.distanceKm.toFixed(1)} km).`;
  } else {
    week = `Matching last week's pace — ${cw.distanceKm.toFixed(1)} km across ${cw.activities} sessions, within ${Math.abs(weekPct)}%.`;
  }

  let month: string;
  if (lmSame.activities === 0) {
    month = `${monthName} is shaping up with ${cm.activities} activities and ${cm.distanceKm.toFixed(0)} km through ${dayOfMonth} days.`;
  } else if (monthPct === null) {
    month = `${cm.activities} activities in ${monthName} through ${dayOfMonth} days.`;
  } else if (monthPct >= 20) {
    month = `${monthName} is ${monthPct}% ahead of the same ${dayOfMonth} days of ${lastMonthName} — strong month so far.`;
  } else if (monthPct >= 5) {
    month = `${monthName} is building nicely — ${cm.distanceKm.toFixed(0)} km vs ${lmSame.distanceKm.toFixed(0)} km through the same ${dayOfMonth} days of ${lastMonthName} (+${monthPct}%).`;
  } else if (monthPct <= -20) {
    month = `${monthName} is ${Math.abs(monthPct)}% behind the same ${dayOfMonth} days of ${lastMonthName} — notably lighter in volume.`;
  } else if (monthPct <= -5) {
    month = `${monthName} is running ${Math.abs(monthPct)}% behind ${lastMonthName}'s pace for the same period — ${cm.distanceKm.toFixed(0)} km vs ${lmSame.distanceKm.toFixed(0)} km.`;
  } else {
    month = `${monthName} is tracking almost identically to ${lastMonthName} through ${dayOfMonth} days — ${cm.distanceKm.toFixed(0)} km, within ${Math.abs(monthPct)}%.`;
  }

  return `${week} ${month}`;
}

function computeInsights(activities: FitnessActivity[]): Insights {
  const now = new Date();

  // Week bounds (Monday-anchored)
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - daysSinceMonday);
  thisMonday.setUTCHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);

  const daysIntoWeek = now.getUTCDay() === 0 ? 7 : now.getUTCDay(); // Mon=1…Sun=7
  const lastWeekSameEnd = new Date(lastMonday);
  lastWeekSameEnd.setUTCDate(lastMonday.getUTCDate() + daysIntoWeek);

  // Month bounds
  const thisMonthStart  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthStart  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const dayOfMonth      = now.getUTCDate();
  const lastMonthSameEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, dayOfMonth + 1));

  // Period aggregates
  const currentWeek       = aggregate(activities.filter(a => inRange(a, thisMonday, now)));
  const lastWeekSameDays  = aggregate(activities.filter(a => inRange(a, lastMonday, lastWeekSameEnd)));
  const currentMonth      = aggregate(activities.filter(a => inRange(a, thisMonthStart, now)));
  const lastMonthSameDays = aggregate(activities.filter(a => inRange(a, lastMonthStart, lastMonthSameEnd)));

  // Pre-bucket by UTC date string for fast day lookups
  const buckets = bucketByDate(activities);

  // Weekly cumulative chart
  const weeklyChart: ChartPoint[] = [];
  let cumCW = 0, cumLW = 0;
  for (let d = 0; d < daysIntoWeek; d++) {
    const cDate = new Date(thisMonday); cDate.setUTCDate(thisMonday.getUTCDate() + d);
    const pDate = new Date(lastMonday); pDate.setUTCDate(lastMonday.getUTCDate() + d);
    cumCW += dayDistKm(buckets, cDate.toISOString().slice(0, 10));
    cumLW += dayDistKm(buckets, pDate.toISOString().slice(0, 10));
    weeklyChart.push({ label: WEEK_LABELS[d], current: +cumCW.toFixed(1), previous: +cumLW.toFixed(1) });
  }

  // Monthly cumulative chart:
  // X axis = full span of last month (e.g. 1–31 for May).
  // Previous line: all days plotted. Current line: stops at today (null beyond).
  const cy = now.getUTCFullYear(), cm = now.getUTCMonth() + 1;
  const pm = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const py = now.getUTCMonth() === 0 ? cy - 1 : cy;
  // Last day of previous month
  const daysInLastMonth = new Date(Date.UTC(cy, now.getUTCMonth(), 0)).getUTCDate();

  const monthlyChart: ChartPoint[] = [];
  let cumCM = 0, cumLM = 0;
  for (let d = 1; d <= daysInLastMonth; d++) {
    const dd = String(d).padStart(2, '0');
    cumLM += dayDistKm(buckets, `${py}-${String(pm).padStart(2, '0')}-${dd}`);
    if (d <= dayOfMonth) {
      cumCM += dayDistKm(buckets, `${cy}-${String(cm).padStart(2, '0')}-${dd}`);
      monthlyChart.push({ label: String(d), current: +cumCM.toFixed(1), previous: +cumLM.toFixed(1) });
    } else {
      // Beyond today: keep plotting previous month, stop current line
      monthlyChart.push({ label: String(d), current: null, previous: +cumLM.toFixed(1) });
    }
  }

  const monthName     = UTC_MONTHS[now.getUTCMonth()];
  const lastMonthName = UTC_MONTHS[(now.getUTCMonth() - 1 + 12) % 12];

  const insight = generateInsight(
    currentWeek, lastWeekSameDays,
    currentMonth, lastMonthSameDays,
    monthName, lastMonthName,
    daysIntoWeek, dayOfMonth,
  );

  return {
    currentWeek, lastWeekSameDays,
    currentMonth, lastMonthSameDays,
    weeklyChart, monthlyChart,
    monthName, lastMonthName,
    daysIntoWeek, dayOfMonth, daysInLastMonth,
    insight,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Delta({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0) return null;
  const p = Math.round(((curr - prev) / prev) * 100);
  const up = p >= 0;
  return (
    <span className={clsx('text-[10px] font-semibold', up ? 'text-green-11' : 'text-red-11')}>
      {up ? '↑' : '↓'} {Math.abs(p)}%
    </span>
  );
}

function StatCompare({ label, curr, prev, format }: {
  label: string; curr: number; prev: number; format: (n: number) => string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-10">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-11 tabular-nums">{format(prev)}</span>
        <span className="text-gray-7">→</span>
        <span className="text-xs font-medium text-gray-12 tabular-nums">{format(curr)}</span>
        <Delta curr={curr} prev={prev} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

function TrendChart({ data, currentLabel, previousLabel, unit, daysInLastMonth }: {
  data: ChartPoint[];
  currentLabel: string;
  previousLabel: string;
  unit: Unit;
  daysInLastMonth?: number; // present for monthly chart; absent for weekly
}) {
  const fmtVal = (km: number) =>
    unit === 'km' ? `${km.toFixed(1)} km` : `${(km / 1.60934).toFixed(1)} mi`;

  const isMonthly = daysInLastMonth !== undefined;

  // Tick marks for monthly chart: 1, 5, 10, 15, 20, 25, 30[, 31]
  const monthTicks = isMonthly
    ? [1, 5, 10, 15, 20, 25, 30, 31]
        .filter(d => d <= (daysInLastMonth ?? 0))
        .map(String)
    : undefined;

  const converted = useMemo(() => data.map(p => ({
    ...p,
    current:  p.current  === null ? null : +(unit === 'km' ? p.current  : p.current  / 1.60934).toFixed(1),
    previous: p.previous === null ? null : +(unit === 'km' ? p.previous : p.previous / 1.60934).toFixed(1),
  })), [data, unit]);

  return (
    <>
      <div className="mb-1 flex items-center justify-end gap-4">
        <div className="flex items-center gap-1.5">
          <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={COLOR_CURRENT} strokeWidth="2" /></svg>
          <span className="text-[10px] text-gray-11">{currentLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={COLOR_PREVIOUS} strokeWidth="2" strokeDasharray="4 3" /></svg>
          <span className="text-[10px] text-gray-11">{previousLabel}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={converted} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#3a3a3a" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#888' }}
            tickLine={false}
            axisLine={false}
            {...(monthTicks ? { ticks: monthTicks } : { interval: 0 })}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#888' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded border border-gray-6 bg-gray-3 px-2.5 py-2 text-xs">
                  <div className="mb-1 font-medium text-gray-11">{label}</div>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="text-gray-12">{fmtVal(+(p.value ?? 0))}</span>
                      <span className="text-gray-10">{p.dataKey === 'current' ? currentLabel : previousLabel}</span>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke={COLOR_CURRENT}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: COLOR_CURRENT, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke={COLOR_PREVIOUS}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3, fill: COLOR_PREVIOUS, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FitnessInsights({
  activities,
  unit,
}: {
  activities: FitnessActivity[];
  unit: Unit;
}) {
  const [tab, setTab] = useState<Tab>('month');

  const ins = useMemo(() => computeInsights(activities), [activities]);

  if (activities.length === 0) return null;

  const isWeek = tab === 'week';
  const curr      = isWeek ? ins.currentWeek      : ins.currentMonth;
  const prev      = isWeek ? ins.lastWeekSameDays : ins.lastMonthSameDays;
  const chartData = isWeek ? ins.weeklyChart      : ins.monthlyChart;
  const currLabel = isWeek ? 'This week'          : ins.monthName;
  const prevLabel = isWeek ? 'Last week'          : ins.lastMonthName;

  const fmtDist = (km: number) =>
    km === 0 ? '0' : unit === 'km' ? `${km.toFixed(1)} km` : `${(km / 1.60934).toFixed(1)} mi`;
  const fmtTime = (h: number) => {
    if (h === 0) return '0m';
    const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
    return hrs === 0 ? `${mins}m` : mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
  };
  const fmtCal = (c: number) => c > 0 ? `${Math.round(c).toLocaleString()} kcal` : '—';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
      {/* Header */}
      <div className="flex h-[4.5rem] items-center gap-2.5 border-b border-gray-6 px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-6 bg-gray-3 text-gray-11">
          <Sparkles size={16} />
        </div>
        <div>
          <div className="font-medium text-gray-12">Progress Insights</div>
          <div className="text-sm text-gray-11">
            Same-period comparison · {ins.monthName} vs {ins.lastMonthName}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* Insight text */}
        <div className="rounded-lg border border-blue-6/50 bg-blue-3/60 px-4 py-3">
          <p className="text-sm leading-relaxed text-blue-11">{ins.insight}</p>
        </div>

        {/* Tab switcher */}
        <div className="flex overflow-hidden rounded-md border border-gray-6">
          {(['week', 'month'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'flex-1 py-1.5 text-xs font-medium transition-colors',
                tab === t ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3',
              )}
            >
              {t === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        {/* Cumulative trend chart */}
        <TrendChart
          data={chartData}
          currentLabel={currLabel}
          previousLabel={prevLabel}
          unit={unit}
          daysInLastMonth={isWeek ? undefined : ins.daysInLastMonth}
        />

        {/* Stats: prev → curr */}
        <div className="divide-y divide-gray-6/50">
          <StatCompare label="Activities" curr={curr.activities} prev={prev.activities} format={n => String(n)} />
          <StatCompare label="Distance"   curr={curr.distanceKm}    prev={prev.distanceKm}    format={fmtDist} />
          <StatCompare label="Time"       curr={curr.durationHours} prev={prev.durationHours} format={fmtTime} />
          <StatCompare label="Calories"   curr={curr.calories}      prev={prev.calories}       format={fmtCal} />
        </div>

        <p className="text-right text-[10px] text-gray-10">
          {isWeek
            ? `First ${ins.daysIntoWeek} days of each week`
            : `First ${ins.dayOfMonth} days of each month`}
        </p>
      </div>
    </div>
  );
}
