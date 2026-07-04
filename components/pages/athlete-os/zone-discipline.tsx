import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

import {
  type ZoneSession, type ZoneMode, type Sport,
  polarize, disciplineScore, disciplineBand, sessionSplit,
} from '@/lib/athlete-os/services/zones/zoneAnalysis';

/**
 * Zone Discipline — visualises polarized-training discipline: how much time is
 * spent easy (Z1–2) vs the grey zone (Z3) vs hard (Z4–5), against the ~80/20
 * ideal. Toggle between Garmin's time-in-zone and a custom max-HR recompute.
 */

const EASY = '#34d399';
const GREY = '#fbbf24';
const HARD = '#f43f5e';
const TARGET_EASY = 80;

function pctLabel(n: number) { return `${Math.round(n)}%`; }

export default function ZoneDiscipline({
  sessions, observedMaxHr,
}: { sessions: ZoneSession[]; observedMaxHr: number | null }) {
  const [mode, setMode] = useState<ZoneMode>('garmin');
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [maxHr, setMaxHr] = useState<number>(observedMaxHr ?? 195);

  const filtered = useMemo(
    () => sessions.filter((s) => sport === 'all' || s.sport === sport),
    [sessions, sport],
  );

  // In Garmin mode, only sessions with time-in-zone data count.
  const usable = useMemo(
    () => filtered.filter((s) => (mode === 'garmin' ? s.zoneSecs.reduce((a, b) => a + b, 0) > 0 : s.avgHr != null)),
    [filtered, mode],
  );

  const polar = useMemo(() => polarize(usable, mode, maxHr), [usable, mode, maxHr]);
  const score = disciplineScore(polar);
  const band = disciplineBand(score);

  // Most recent sessions for the timeline bars.
  const recent = useMemo(
    () => usable.slice(0, 40).map((s) => ({ s, split: sessionSplit(s, mode, maxHr) })).reverse(),
    [usable, mode, maxHr],
  );

  if (sessions.length === 0) {
    return <div className="p-8 text-center text-sm text-gray-11">No zone data available yet.</div>;
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Segmented label="Sport" options={['all', 'run', 'ride'] as const} value={sport} onChange={setSport}
            fmt={(v) => (v === 'all' ? 'All' : v === 'run' ? 'Run' : 'Ride')} />
          <Segmented label="Zones from" options={['garmin', 'maxhr'] as const} value={mode} onChange={setMode}
            fmt={(v) => (v === 'garmin' ? 'Garmin' : 'Max HR')} />
          {mode === 'maxhr' && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-10">Max HR</span>
              <input
                type="number" value={maxHr} min={120} max={230}
                onChange={(e) => setMaxHr(Number(e.target.value) || 195)}
                className="w-20 rounded-md border border-gray-6 bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none focus:border-gray-8"
              />
            </label>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-gray-10">Discipline</div>
          <div className="text-2xl font-semibold" style={{ color: score >= 60 ? EASY : score >= 40 ? GREY : HARD }}>
            {score} <span className="text-sm font-normal text-gray-11">{band}</span>
          </div>
        </div>
      </div>

      {mode === 'maxhr' && (
        <p className="-mt-2 text-xs text-gray-10">
          Max-HR mode classifies each session by its <em>average</em> HR (session-level), not time-in-zone.
        </p>
      )}

      {/* Polarization bar vs 80/20 target */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-gray-11">
          <span>Time distribution · {polar.sessions} sessions</span>
          <span className="text-gray-10">Target: ~80% easy</span>
        </div>
        <div className="relative flex h-8 overflow-hidden rounded-lg">
          <Bar w={polar.easy} color={EASY} label={polar.easy >= 8 ? `Easy ${pctLabel(polar.easy)}` : ''} />
          <Bar w={polar.grey} color={GREY} label={polar.grey >= 8 ? `Grey ${pctLabel(polar.grey)}` : ''} />
          <Bar w={polar.hard} color={HARD} label={polar.hard >= 8 ? `Hard ${pctLabel(polar.hard)}` : ''} />
          {/* 80% target marker */}
          <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-12/60" style={{ left: `${TARGET_EASY}%` }} />
        </div>
        <div className="flex gap-4 text-xs text-gray-11">
          <Legend color={EASY} label={`Easy Z1–2 · ${pctLabel(polar.easy)}`} />
          <Legend color={GREY} label={`Grey Z3 · ${pctLabel(polar.grey)}`} />
          <Legend color={HARD} label={`Hard Z4–5 · ${pctLabel(polar.hard)}`} />
        </div>
      </div>

      {/* Verdict */}
      <div className="rounded-lg border border-gray-6 bg-gray-2 px-4 py-3 text-sm text-gray-11">
        {polar.easy < 50 ? (
          <>
            Only <span className="font-semibold" style={{ color: EASY }}>{pctLabel(polar.easy)}</span> of your{' '}
            {sport === 'all' ? 'training' : sport === 'run' ? 'running' : 'riding'} time is truly easy (Z1–2), with{' '}
            <span className="font-semibold" style={{ color: GREY }}>{pctLabel(polar.grey)}</span> stuck in the grey zone.
            Polarized training wants ~80% easy — you have almost no aerobic base.
          </>
        ) : polar.easy < TARGET_EASY ? (
          <>Getting closer — <span className="font-semibold" style={{ color: EASY }}>{pctLabel(polar.easy)}</span> easy vs the ~80% target. Keep pushing easy days easier.</>
        ) : (
          <>Nicely polarized — <span className="font-semibold" style={{ color: EASY }}>{pctLabel(polar.easy)}</span> easy. Protect this base.</>
        )}
      </div>

      {/* Per-session timeline */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">Recent sessions</span>
        <div className="flex items-end gap-[3px]" style={{ height: 88 }}>
          {recent.map(({ s, split }, i) => (
            <motion.div
              key={i}
              className="group relative flex-1 overflow-hidden rounded-sm"
              style={{ height: '100%', minWidth: 4 }}
              initial={{ opacity: 0, scaleY: 0.4 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.01, 0.3) }}
              title={`${s.date} · ${s.sport} · Easy ${Math.round(split.easy)}% / Grey ${Math.round(split.grey)}% / Hard ${Math.round(split.hard)}%`}
            >
              <div style={{ height: `${split.hard}%`, background: HARD }} />
              <div style={{ height: `${split.grey}%`, background: GREY }} />
              <div style={{ height: `${split.easy}%`, background: EASY }} />
            </motion.div>
          ))}
        </div>
        <span className="text-[10px] text-gray-10">Each bar = one session, oldest → newest. A healthy easy day is mostly green.</span>
      </div>
    </div>
  );
}

function Bar({ w, color, label }: { w: number; color: string; label: string }) {
  if (w <= 0) return null;
  return (
    <div className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-medium text-black/70" style={{ width: `${w}%`, background: color }}>
      {label}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Segmented<T extends string>({
  label, options, value, onChange, fmt,
}: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; fmt: (v: T) => string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-10">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-gray-6">
        {options.map((opt) => (
          <button key={opt} onClick={() => onChange(opt)}
            className={clsx('px-3 py-1.5 text-xs font-medium transition-colors',
              value === opt ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3')}>
            {fmt(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}
