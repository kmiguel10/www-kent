import type { GetServerSideProps, NextPage } from 'next';

import BaseLayout from '@/components/layouts/base';
import ContainerLayout from '@/components/layouts/container';
import FitnessDashboard from '@/components/pages/fitness/fitness-dashboard';
import fitnessSupabase from '@/lib/services/fitness-supabase';

export interface FitnessActivity {
  id: string;
  source: 'strava' | 'garmin';
  name: string | null;
  sport_type: string | null;
  start_time: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  calories: number | null;
  avg_heart_rate: number | null;
}

type Props = {
  activities: FitnessActivity[];
};

const FitnessPage: NextPage<Props> = ({ activities }) => {
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
        <FitnessDashboard activities={activities} />
      </ContainerLayout>
    </BaseLayout>
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const { data, error } = await fitnessSupabase
    .from('activities')
    .select('id, source, name, sport_type, start_time, duration_seconds, distance_meters, calories, avg_heart_rate')
    .order('start_time', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('fitness fetch error:', error.message);
    return { props: { activities: [] } };
  }

  return { props: { activities: (data as FitnessActivity[]) ?? [] } };
};

export default FitnessPage;
