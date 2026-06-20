import type { NextPage } from 'next';

import BaseLayout from '@/components/layouts/base';
import ContainerLayout from '@/components/layouts/container';
import FitnessDashboard from '@/components/pages/fitness/fitness-dashboard';

export interface FitnessSleepRecord {
  id: string;
  date: string;
  sleep_start: number | null;
  sleep_end: number | null;
  duration_minutes: number | null;
  deep_minutes: number | null;
  light_minutes: number | null;
  rem_minutes: number | null;
  awake_minutes: number | null;
  sleep_score: number | null;
  sleep_stress: number | null;
  respiration_avg: number | null;
  pulse_ox_avg: number | null;
}

export interface FitnessRecoveryRecord {
  id: string;
  date: string;
  resting_hr: number | null;
  hrv: number | null;
  hrv_status: string | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  stress_avg: number | null;
  training_readiness: number | null;
  recovery_time_hours: number | null;
}

export interface FitnessActivity {
  id: string;
  source: 'strava' | 'garmin';
  name: string | null;
  sport_type: string | null;
  start_time: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  elevation_gain_meters: number | null;
  calories: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_pace_seconds_per_km: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_data: Record<string, any> | null;
}

const FitnessPage: NextPage = () => {
  return (
    <BaseLayout subtitle="Fitness" pageSlug="/fitness">
      <ContainerLayout className="flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-12 md:text-4xl">
            Fitness
          </h1>
          <p className="mt-2 text-gray-11">
            Training data synced from Strava and Garmin.
          </p>
        </div>
        <FitnessDashboard />
      </ContainerLayout>
    </BaseLayout>
  );
};

export default FitnessPage;
