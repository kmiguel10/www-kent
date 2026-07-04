import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { AthleteScore } from '@/lib/athlete-os/types';

/**
 * Athlete Orb — a premium SVG gauge with animated arcs and a soft glow that
 * summarises the day's readiness and explains its drivers. Built with SVG +
 * framer-motion (no 3D dependency needed for a 2D radial gauge).
 */

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 104;
const CIRC = 2 * Math.PI * RADIUS;

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 65) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 35) return '#f97316';
  return '#ef4444';
}

function Ring({
  radius, value, color, delay, width = 8,
}: { radius: number; value: number; color: string; delay: number; width?: number }) {
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <>
      <circle cx={CENTER} cy={CENTER} r={radius} fill="none" stroke="var(--gray-4)" strokeWidth={width} />
      <motion.circle
        cx={CENTER} cy={CENTER} r={radius} fill="none" stroke={color} strokeWidth={width}
        strokeLinecap="round" transform={`rotate(-90 ${CENTER} ${CENTER})`}
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - pct) }}
        transition={{ duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </>
  );
}

export default function AthleteOrb({ today }: { today: AthleteScore | null }) {
  const color = today ? scoreColor(today.score) : 'var(--gray-8)';
  const positives = useMemo(() => (today?.contributors ?? []).filter((c) => c.delta > 0).slice(0, 4), [today]);
  const negatives = useMemo(() => (today?.contributors ?? []).filter((c) => c.delta < 0).slice(0, 3), [today]);

  if (!today) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-sm text-gray-11">Not enough data to score today.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6 lg:flex-row lg:items-center lg:gap-10">
      {/* Orb */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: color, opacity: 0.18 }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.18 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
        />
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <defs>
            <radialGradient id="orbCore" cx="50%" cy="42%" r="60%">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="70%" stopColor={color} stopOpacity={0.05} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx={CENTER} cy={CENTER} r={RADIUS - 18} fill="url(#orbCore)" />
          {/* Outer: athlete score */}
          <Ring radius={RADIUS} value={today.score} color={color} delay={0.1} width={10} />
          {/* Inner rings: sub-scores */}
          {today.recovery != null && <Ring radius={RADIUS - 22} value={today.recovery} color="#16a34a" delay={0.35} />}
          {today.sleepQuality != null && <Ring radius={RADIUS - 40} value={today.sleepQuality} color="#0090FF" delay={0.5} />}
          {today.marathonReadiness != null && <Ring radius={RADIUS - 58} value={today.marathonReadiness} color="#2dd4bf" delay={0.65} />}

          <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="fill-gray-12" style={{ fontSize: 46, fontWeight: 700 }}>
            {Math.round(today.score)}
          </text>
          <text x={CENTER} y={CENTER + 20} textAnchor="middle" className="fill-gray-11" style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
            {today.band}
          </text>
        </svg>
      </div>

      {/* Breakdown */}
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
          <SubStat label="Recovery" value={today.recovery} color="#16a34a" />
          <SubStat label="Sleep" value={today.sleepQuality} color="#0090FF" />
          <SubStat label="Readiness" value={today.trainingReadiness} color="#14b8a6" />
          <SubStat label="Marathon" value={today.marathonReadiness} color="#2dd4bf" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-10">Why</span>
          <div className="flex flex-col gap-1">
            {positives.map((c, i) => <Contributor key={`p-${i}`} label={c.label} delta={c.delta} />)}
            {negatives.map((c, i) => <Contributor key={`n-${i}`} label={c.label} delta={c.delta} />)}
            {positives.length === 0 && negatives.length === 0 && (
              <span className="text-xs text-gray-10">Balanced day — no strong drivers.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubStat({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-6 bg-gray-2 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-10">{label}</span>
      <span className="text-xl font-semibold" style={{ color: value != null ? color : 'var(--gray-8)' }}>
        {value != null ? value : '—'}
      </span>
    </div>
  );
}

function Contributor({ label, delta }: { label: string; delta: number }) {
  const positive = delta > 0;
  return (
    <motion.div
      className="flex items-center justify-between text-sm"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <span className="text-gray-11">{label}</span>
      <span className={positive ? 'font-medium text-green-400' : 'font-medium text-red-400'}>
        {positive ? '+' : ''}{delta}
      </span>
    </motion.div>
  );
}
