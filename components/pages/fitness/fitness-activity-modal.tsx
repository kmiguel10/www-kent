import * as Dialog from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { X } from 'lucide-react';

import type { FitnessActivity } from '@/pages/fitness';

type Unit = 'km' | 'mi';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPORT_LABELS: Record<string, string> = {
  Run: 'Run', TrailRun: 'Trail Run', VirtualRun: 'Virtual Run',
  running: 'Run', treadmill_running: 'Treadmill Run', trail_running: 'Trail Run',
  track_running: 'Track Run', indoor_running: 'Indoor Run', virtual_run: 'Virtual Run',
  Ride: 'Ride', VirtualRide: 'Virtual Ride', MountainBikeRide: 'MTB',
  GravelRide: 'Gravel Ride', EBikeRide: 'E-Bike',
  road_biking: 'Road Bike', virtual_ride: 'Virtual Ride',
  Swim: 'Swim', open_water_swimming: 'Open Water Swim',
  Walk: 'Walk', walking: 'Walk', Hike: 'Hike',
  WeightTraining: 'Strength', Workout: 'Workout', Yoga: 'Yoga',
  AlpineSki: 'Alpine Ski', breathwork: 'Breathwork',
};

const SPORT_EMOJI: Record<string, string> = {
  Run: '🏃', TrailRun: '🏔️', VirtualRun: '🏃',
  running: '🏃', treadmill_running: '🏃', trail_running: '🏔️',
  track_running: '🏟️', indoor_running: '🏃', virtual_run: '🏃',
  Ride: '🚴', VirtualRide: '🚴', MountainBikeRide: '🚵',
  GravelRide: '🚴', EBikeRide: '⚡', road_biking: '🚴', virtual_ride: '🚴',
  Swim: '🏊', open_water_swimming: '🌊',
  Walk: '🚶', walking: '🚶', Hike: '🥾',
  WeightTraining: '🏋️', Workout: '💪', Yoga: '🧘',
  AlpineSki: '⛷️', breathwork: '🌬️',
};

const RUN_TYPES = new Set([
  'Run', 'TrailRun', 'VirtualRun', 'running', 'treadmill_running',
  'trail_running', 'track_running', 'indoor_running', 'virtual_run',
]);

const GARMIN_TE_MESSAGES: Record<string, string> = {
  OVERREACHING_17: 'Overreaching',
  RECOVERY_3: 'Recovery',
  BASE_3: 'Maintaining Base',
  IMPROVING_BASE_3: 'Improving Base',
  IMPROVING_AEROBIC_BASE_2: 'Improving Aerobic Base',
  IMPROVING_AEROBIC_BASE_3: 'Improving Aerobic Base',
  IMPROVING_ANAEROBIC_BASE_2: 'Improving Anaerobic Base',
  IMPROVING_ANAEROBIC_BASE_3: 'Improving Anaerobic Base',
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const fmt = {
  date(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  },
  time(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  },
  duration(s: number | null | undefined) {
    if (!s) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.round(s % 60);
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
  },
  distance(m: number | null | undefined, unit: Unit) {
    if (!m) return '—';
    const val = unit === 'km' ? m / 1000 : m / 1609.344;
    return `${val.toFixed(2)} ${unit}`;
  },
  elevation(m: number | null | undefined) {
    if (m === null || m === undefined) return '—';
    return `${Math.round(m)} m`;
  },
  pace(secPerKm: number | null | undefined, unit: Unit) {
    if (!secPerKm) return '—';
    const s = unit === 'km' ? secPerKm : secPerKm * 1.60934;
    const min = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${min}:${String(sec).padStart(2, '0')} /${unit}`;
  },
  speed(mps: number | null | undefined, unit: Unit) {
    if (!mps) return '—';
    const val = unit === 'km' ? mps * 3.6 : mps * 2.23694;
    return `${val.toFixed(1)} ${unit}/h`;
  },
  hr(bpm: number | null | undefined) {
    if (!bpm) return '—';
    return `${Math.round(bpm)} bpm`;
  },
  power(w: number | null | undefined) {
    if (!w) return '—';
    return `${Math.round(w)} W`;
  },
  calories(cal: number | null | undefined) {
    if (!cal) return '—';
    return `${Math.round(cal).toLocaleString()} kcal`;
  },
  cadence(spm: number | null | undefined, isHalfCadence = false) {
    if (!spm) return '—';
    const val = isHalfCadence ? Math.round(spm * 2) : Math.round(spm);
    return `${val} spm`;
  },
  split(seconds: number | null | undefined, unit: Unit) {
    if (!seconds) return '—';
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${min}:${String(sec).padStart(2, '0')} /${unit}`;
  },
  teLabel(msg: string | undefined) {
    if (!msg) return '—';
    return GARMIN_TE_MESSAGES[msg] ?? msg.replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Row({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5 text-sm text-gray-11">
        <span className="w-5 text-center text-base leading-none">{emoji}</span>
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-12">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-3">
      <div className="mb-1 flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-6" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-10">{title}</span>
        <div className="h-px flex-1 bg-gray-6" />
      </div>
      <div className="divide-y divide-gray-6/60">{children}</div>
    </div>
  );
}

function HRZoneBar({ zones }: { zones: (number | undefined)[] }) {
  const total = zones.reduce<number>((s, v) => s + (v ?? 0), 0);
  if (!total) return null;
  const colors = ['bg-blue-9', 'bg-green-9', 'bg-yellow-9', 'bg-orange-9', 'bg-red-9'];
  const labels = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
  return (
    <div className="py-2">
      <div className="mb-1.5 flex gap-0.5 overflow-hidden rounded-full">
        {zones.map((v, i) => {
          const pct = ((v ?? 0) / total) * 100;
          if (pct < 1) return null;
          return (
            <div
              key={i}
              className={clsx('h-2 transition-all', colors[i])}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="flex gap-3">
        {zones.map((v, i) => {
          const mins = Math.round((v ?? 0) / 60);
          if (!mins) return null;
          return (
            <div key={i} className="flex items-center gap-1">
              <span className={clsx('h-2 w-2 rounded-full', colors[i])} />
              <span className="text-[10px] text-gray-11">{labels[i]} {mins}m</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source-specific section builders
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StravaExtra({ r, unit, isRun }: { r: Record<string, any>; unit: Unit; isRun: boolean }) {
  return (
    <>
      {/* Performance */}
      <Section title="Performance">
        {isRun ? (
          <Row emoji="💨" label="Avg Pace" value={fmt.pace(r.average_speed ? 1000 / r.average_speed : null, unit)} />
        ) : (
          <Row emoji="⚡" label="Avg Speed" value={fmt.speed(r.average_speed, unit)} />
        )}
        <Row emoji="🚀" label="Max Speed" value={fmt.speed(r.max_speed, unit)} />
        {r.average_watts != null && <Row emoji="⚡" label="Avg Power" value={fmt.power(r.average_watts)} />}
        {r.max_watts != null && <Row emoji="📈" label="Max Power" value={fmt.power(r.max_watts)} />}
        {r.weighted_average_watts != null && <Row emoji="⚖️" label="Weighted Avg Power" value={fmt.power(r.weighted_average_watts)} />}
        {r.kilojoules != null && <Row emoji="⚡" label="Energy Output" value={`${Math.round(r.kilojoules).toLocaleString()} kJ`} />}
        {r.average_cadence != null && (
          <Row emoji="🔄" label="Avg Cadence" value={fmt.cadence(r.average_cadence, isRun)} />
        )}
      </Section>

      {/* Heart Rate */}
      {r.has_heartrate && (
        <Section title="Heart Rate">
          <Row emoji="❤️" label="Avg Heart Rate" value={fmt.hr(r.average_heartrate)} />
          <Row emoji="💓" label="Max Heart Rate" value={fmt.hr(r.max_heartrate)} />
        </Section>
      )}

      {/* Elevation */}
      <Section title="Elevation">
        <Row emoji="⛰️" label="Total Gain" value={fmt.elevation(r.total_elevation_gain)} />
        <Row emoji="🔼" label="High Point" value={fmt.elevation(r.elev_high)} />
        <Row emoji="🔽" label="Low Point" value={fmt.elevation(r.elev_low)} />
      </Section>

      {/* Activity details */}
      <Section title="Details">
        <Row emoji="⏱️" label="Elapsed Time" value={fmt.duration(r.elapsed_time)} />
        <Row emoji="🏃" label="Moving Time" value={fmt.duration(r.moving_time)} />
        {r.suffer_score != null && <Row emoji="😤" label="Suffer Score" value={String(r.suffer_score)} />}
        {r.pr_count != null && r.pr_count > 0 && <Row emoji="🏅" label="PRs" value={String(r.pr_count)} />}
        {r.kudos_count != null && <Row emoji="👏" label="Kudos" value={String(r.kudos_count)} />}
        {r.device_name && <Row emoji="📱" label="Device" value={r.device_name} />}
      </Section>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GarminExtra({ r, unit, isRun }: { r: Record<string, any>; unit: Unit; isRun: boolean }) {
  const hrZones = [r.hrTimeInZone_1, r.hrTimeInZone_2, r.hrTimeInZone_3, r.hrTimeInZone_4, r.hrTimeInZone_5];
  const hasHRZones = hrZones.some(v => v != null && v > 0);

  return (
    <>
      {/* Performance */}
      <Section title="Performance">
        {isRun ? (
          <Row emoji="💨" label="Avg Pace" value={fmt.pace(r.averageSpeed ? 1000 / r.averageSpeed : null, unit)} />
        ) : (
          <Row emoji="⚡" label="Avg Speed" value={fmt.speed(r.averageSpeed, unit)} />
        )}
        <Row emoji="🚀" label="Max Speed" value={fmt.speed(r.maxSpeed, unit)} />
        {r.avgPower != null && <Row emoji="⚡" label="Avg Power" value={fmt.power(r.avgPower)} />}
        {r.maxPower != null && <Row emoji="📈" label="Max Power" value={fmt.power(r.maxPower)} />}
        {r.normPower != null && <Row emoji="⚖️" label="Normalized Power" value={fmt.power(r.normPower)} />}
        {r.averageRunningCadenceInStepsPerMinute != null && (
          <Row emoji="🔄" label="Avg Cadence" value={`${Math.round(r.averageRunningCadenceInStepsPerMinute)} spm`} />
        )}
        {r.maxRunningCadenceInStepsPerMinute != null && (
          <Row emoji="🔄" label="Max Cadence" value={`${Math.round(r.maxRunningCadenceInStepsPerMinute)} spm`} />
        )}
        {r.steps != null && <Row emoji="👟" label="Total Steps" value={r.steps.toLocaleString()} />}
      </Section>

      {/* Heart Rate */}
      {(r.averageHR || r.maxHR) && (
        <Section title="Heart Rate">
          <Row emoji="❤️" label="Avg Heart Rate" value={fmt.hr(r.averageHR)} />
          <Row emoji="💓" label="Max Heart Rate" value={fmt.hr(r.maxHR)} />
          {hasHRZones && <HRZoneBar zones={hrZones} />}
        </Section>
      )}

      {/* Running Dynamics */}
      {isRun && (r.avgStrideLength || r.avgGroundContactTime || r.avgVerticalOscillation) && (
        <Section title="Running Dynamics">
          {r.avgStrideLength != null && <Row emoji="📐" label="Stride Length" value={`${r.avgStrideLength.toFixed(1)} cm`} />}
          {r.avgGroundContactTime != null && <Row emoji="⏬" label="Ground Contact Time" value={`${Math.round(r.avgGroundContactTime)} ms`} />}
          {r.avgGroundContactBalance != null && <Row emoji="⚖️" label="Ground Contact Balance" value={`${r.avgGroundContactBalance.toFixed(1)}%`} />}
          {r.avgVerticalOscillation != null && <Row emoji="↕️" label="Vertical Oscillation" value={`${r.avgVerticalOscillation.toFixed(1)} cm`} />}
          {r.avgVerticalRatio != null && <Row emoji="📊" label="Vertical Ratio" value={`${r.avgVerticalRatio.toFixed(1)}%`} />}
        </Section>
      )}

      {/* Breathing */}
      {r.avgRespirationRate != null && (
        <Section title="Breathing">
          <Row emoji="🌬️" label="Avg Respiration" value={`${r.avgRespirationRate.toFixed(1)} brpm`} />
          {r.maxRespirationRate != null && <Row emoji="💨" label="Max Respiration" value={`${r.maxRespirationRate.toFixed(1)} brpm`} />}
          {r.minRespirationRate != null && <Row emoji="😮‍💨" label="Min Respiration" value={`${r.minRespirationRate.toFixed(1)} brpm`} />}
        </Section>
      )}

      {/* Training */}
      {(r.activityTrainingLoad || r.aerobicTrainingEffect || r.vO2MaxValue) && (
        <Section title="Training">
          {r.activityTrainingLoad != null && <Row emoji="📊" label="Training Load" value={Math.round(r.activityTrainingLoad).toString()} />}
          {r.vO2MaxValue != null && <Row emoji="🫁" label="VO₂ Max" value={String(r.vO2MaxValue)} />}
          {r.aerobicTrainingEffect != null && (
            <Row
              emoji="🫀"
              label="Aerobic Effect"
              value={`${r.aerobicTrainingEffect} · ${fmt.teLabel(r.aerobicTrainingEffectMessage)}`}
            />
          )}
          {r.anaerobicTrainingEffect != null && (
            <Row
              emoji="⚡"
              label="Anaerobic Effect"
              value={`${r.anaerobicTrainingEffect} · ${fmt.teLabel(r.anaerobicTrainingEffectMessage)}`}
            />
          )}
          {r.moderateIntensityMinutes != null && <Row emoji="🟡" label="Moderate Intensity" value={`${r.moderateIntensityMinutes} min`} />}
          {r.vigorousIntensityMinutes != null && <Row emoji="🔴" label="Vigorous Intensity" value={`${r.vigorousIntensityMinutes} min`} />}
        </Section>
      )}

      {/* Fastest Splits */}
      {(r.fastestSplit_1000 || r.fastestSplit_1609 || r.fastestSplit_5000) && (
        <Section title="Fastest Splits">
          {r.fastestSplit_1000 && <Row emoji="⚡" label="1 km" value={fmt.split(r.fastestSplit_1000, 'km')} />}
          {r.fastestSplit_1609 && <Row emoji="⚡" label="1 mile" value={fmt.split(r.fastestSplit_1609, 'mi')} />}
          {r.fastestSplit_5000 && <Row emoji="⚡" label="5 km" value={fmt.split(r.fastestSplit_5000, 'km')} />}
        </Section>
      )}

      {/* Elevation */}
      <Section title="Elevation">
        {r.elevationGain != null && <Row emoji="⛰️" label="Elevation Gain" value={fmt.elevation(r.elevationGain)} />}
        {r.elevationLoss != null && <Row emoji="🔽" label="Elevation Loss" value={fmt.elevation(r.elevationLoss)} />}
        {r.maxElevation != null && <Row emoji="🔼" label="High Point" value={fmt.elevation(r.maxElevation)} />}
        {r.minElevation != null && <Row emoji="🔽" label="Low Point" value={fmt.elevation(r.minElevation)} />}
      </Section>

      {/* Details */}
      <Section title="Details">
        <Row emoji="⏱️" label="Elapsed Time" value={fmt.duration(r.elapsedDuration)} />
        <Row emoji="🏃" label="Moving Time" value={fmt.duration(r.movingDuration)} />
        {r.calories != null && <Row emoji="🔥" label="Calories" value={fmt.calories(r.calories)} />}
        {r.waterEstimated != null && <Row emoji="💧" label="Estimated Water" value={`${r.waterEstimated} ml`} />}
        {r.pr === true && <Row emoji="🏅" label="Personal Record" value="Yes" />}
        {r.lapCount != null && <Row emoji="🔁" label="Laps" value={String(r.lapCount)} />}
        {r.locationName && <Row emoji="📍" label="Location" value={r.locationName} />}
        {r.manufacturer && <Row emoji="📱" label="Device" value={r.manufacturer === 'GARMIN' ? 'Garmin' : r.manufacturer} />}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

type Props = { activity: FitnessActivity | null; unit: Unit; onClose: () => void };

export default function FitnessActivityModal({ activity, unit, onClose }: Props) {
  const open = activity !== null;
  const raw = activity?.raw_data ?? {};
  const isRun = RUN_TYPES.has(activity?.sport_type ?? '');
  const sportEmoji = SPORT_EMOJI[activity?.sport_type ?? ''] ?? '🏅';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-gray-1/80 backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms_ease]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-gray-6 bg-gray-2 shadow-xl outline-none data-[state=open]:animate-[slide-up_200ms_ease]"
          style={{ maxHeight: '90vh' }}
          onEscapeKeyDown={onClose}
          onPointerDownOutside={onClose}
        >
          {activity && (
            <>
              {/* Fixed header */}
              <div className="shrink-0 border-b border-gray-6 p-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{sportEmoji}</span>
                      <Dialog.Title className="truncate text-base font-semibold text-gray-12">
                        {activity.name ?? 'Untitled Activity'}
                      </Dialog.Title>
                    </div>
                    <Dialog.Description className="mt-1 text-xs text-gray-11">
                      📅 {fmt.date(activity.start_time)} · {fmt.time(activity.start_time)}
                    </Dialog.Description>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {activity.sport_type && (
                        <span className="rounded border border-gray-6 bg-gray-3 px-2 py-0.5 text-xs font-medium text-gray-12">
                          {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
                        </span>
                      )}
                      <span className={clsx(
                        'rounded border px-2 py-0.5 text-xs font-medium',
                        activity.source === 'strava'
                          ? 'border-orange-6 bg-orange-3 text-orange-11'
                          : 'border-blue-6 bg-blue-3 text-blue-11',
                      )}>
                        {activity.source === 'strava' ? '🟠 Strava' : '🔵 Garmin'}
                      </span>
                    </div>
                  </div>
                  <Dialog.Close
                    onClick={onClose}
                    className="mt-0.5 shrink-0 rounded-md p-1.5 text-gray-10 transition-colors hover:bg-gray-4 hover:text-gray-12"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </Dialog.Close>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto px-5 pb-5">
                {/* Core stats — always shown */}
                <Section title="Activity">
                  <Row emoji="📏" label="Distance" value={fmt.distance(activity.distance_meters, unit)} />
                  <Row emoji="⏱️" label="Duration" value={fmt.duration(activity.duration_seconds)} />
                  <Row emoji="🔥" label="Calories" value={fmt.calories(activity.calories)} />
                </Section>

                {/* Source-specific extended data */}
                {activity.source === 'strava' && Object.keys(raw).length > 0 && (
                  <StravaExtra r={raw} unit={unit} isRun={isRun} />
                )}
                {activity.source === 'garmin' && Object.keys(raw).length > 0 && (
                  <GarminExtra r={raw} unit={unit} isRun={isRun} />
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
