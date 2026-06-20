import { useEffect, useState } from 'react';

import { Footprints } from 'lucide-react';

import ContentDisplay from '@/components/templates/new-templates/content-display';

import RunningDetails from './running-details';

const Running = () => {
  const [runData, setRunData] = useState<MonthlyData[]>([]);
  const [dailyRunData, setDailyRunData] = useState<MileageLog[]>([]);

  useEffect(() => {
    fetch('/api/fitness/running-data')
      .then((r) => r.json())
      .then(({ monthly, daily }: { monthly: MonthlyData[]; daily: MileageLog[] }) => {
        setRunData(monthly);
        setDailyRunData(daily);
      })
      .catch(console.error);
  }, []);

  return (
    <ContentDisplay
      className="col-span-2 h-64 w-full min-[560px]:col-span-4"
      name="Running"
      description="Getting better at running"
      symbol={<Footprints />}
    >
      <RunningDetails runMonthlyData={runData} dailyData={dailyRunData} />
    </ContentDisplay>
  );
};

export default Running;
