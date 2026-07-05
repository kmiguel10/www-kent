import { useMemo, useState } from 'react';
import clsx from 'clsx';

import { type RideSummary, buildCyclingModel } from '@/lib/athlete-os/services/aerobic/aerobicAnalysis';
import { type RunSummary, buildRunningModel } from '@/lib/athlete-os/services/aerobic/runningAnalysis';
import AerobicView from './aerobic-zone2';

/**
 * Aerobic Engine — Cycling / Running toggle over the shared AerobicView. Each
 * sport builds a sport-agnostic model from its own HR–intensity history.
 */

type Sport = 'cycling' | 'running';

export default function AerobicEngine({ rides, runs }: { rides: RideSummary[]; runs: RunSummary[] }) {
  const [sport, setSport] = useState<Sport>('cycling');

  const cyclingModel = useMemo(() => buildCyclingModel(rides), [rides]);
  const runningModel = useMemo(() => buildRunningModel(runs), [runs]);
  const model = sport === 'cycling' ? cyclingModel : runningModel;

  return (
    <div className="flex flex-col">
      <div className="flex justify-end px-4 pt-4">
        <div className="flex overflow-hidden rounded-md border border-gray-6">
          {(['cycling', 'running'] as Sport[]).map((s) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={clsx(
                'px-4 py-1.5 text-xs font-semibold capitalize transition-colors',
                sport === s ? 'bg-gray-4 text-gray-12' : 'text-gray-11 hover:bg-gray-3',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <AerobicView model={model} />
    </div>
  );
}
