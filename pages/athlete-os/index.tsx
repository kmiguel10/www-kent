import type { NextPage } from 'next';

import BaseLayout from '@/components/layouts/base';
import ContainerLayout from '@/components/layouts/container';
import AthleteOsDashboard from '@/components/pages/athlete-os/athlete-os-dashboard';

const AthleteOsPage: NextPage = () => {
  return (
    <BaseLayout subtitle="Athlete OS" pageSlug="/athlete-os">
      <ContainerLayout className="flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-12 md:text-4xl">
            Athlete OS
          </h1>
          <p className="mt-2 max-w-2xl text-gray-11">
            A system for understanding how recovery, sleep, training, and running performance
            relate — surfacing correlations and insights across Garmin, WHOOP, and Strava that
            no single platform shows on its own.
          </p>
        </div>
        <AthleteOsDashboard />
      </ContainerLayout>
    </BaseLayout>
  );
};

export default AthleteOsPage;
