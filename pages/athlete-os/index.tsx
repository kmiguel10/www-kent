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
            A system for understanding what actually moves my training — pairing WHOOP sleep,
            recovery and habits with Garmin run and ride performance, and projecting where it
            all lands on race day.
          </p>
        </div>
        <AthleteOsDashboard />
      </ContainerLayout>
    </BaseLayout>
  );
};

export default AthleteOsPage;
