import {
  Fragment,
  type FC,
  type PointerEvent,
  useCallback,
  useMemo,
} from 'react';

import { TooltipWithBounds, useTooltip, useTooltipInPortal } from '@visx/tooltip';
import clsx from 'clsx';

import type { StressDayRecord } from '@/pages/api/fitness/stress-data';

const SQUARE_SIZE = 12;
const GAP = 2;

type HeatmapDay = { date: string; stress: number } | null | undefined;

const FitnessStressHeatmap: FC<{ records: StressDayRecord[] }> = ({ records }) => {
  const year = new Date().getFullYear();

  const { containerRef, containerBounds } = useTooltipInPortal({ scroll: true, detectBounds: true });
  const { showTooltip, hideTooltip, tooltipOpen, tooltipLeft, tooltipTop, tooltipData } =
    useTooltip<string>({ tooltipOpen: false });

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const tLeft = ('clientX' in event ? event.clientX : 0) - containerBounds.left;
      const tTop = ('clientY' in event ? event.clientY : 0) - containerBounds.top;
      const target = event.target as SVGPathElement;
      const dataDate = target.getAttribute('data-date') ?? undefined;
      const dataStress = target.getAttribute('data-stress') ?? undefined;
      const data =
        dataDate !== undefined && dataStress !== undefined
          ? JSON.stringify({ date: dataDate, stress: dataStress })
          : undefined;
      showTooltip({ tooltipLeft: tLeft, tooltipTop: tTop, tooltipData: data });
    },
    [containerBounds.left, containerBounds.top, showTooltip],
  );

  const stressByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of records) {
      map[r.date] = r.stress_avg;
    }
    return map;
  }, [records]);

  const firstDay = useMemo(() => new Date(Date.UTC(year, 0, 1)), [year]);
  const dayOffset = useMemo(() => firstDay.getUTCDay(), [firstDay]);

  const grid = useMemo(() => {
    const rows: HeatmapDay[][] = Array(7)
      .fill(null)
      .map(() => new Array(53).fill(null));
    const date = new Date(Date.UTC(year, 0, 1));
    const daysInYear = year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0) ? 366 : 365;
    for (let i = 0; i < daysInYear; i++) {
      const dow = date.getUTCDay();
      const col = Math.floor(i / 7) + (date.getUTCDay() < dayOffset ? 1 : 0);
      const key = date.toISOString().slice(0, 10);
      const stress = stressByDate[key];
      rows[dow][col] = { date: key, stress: stress ?? -1 };
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return rows;
  }, [year, dayOffset, stressByDate]);

  const maxStress = useMemo(
    () => Math.max(100, ...records.map((r) => r.stress_avg)),
    [records],
  );

  const avgStress = useMemo(() => {
    if (records.length === 0) return 0;
    return Math.round(records.reduce((s, r) => s + r.stress_avg, 0) / records.length);
  }, [records]);

  const svgWidth = 53 * SQUARE_SIZE + 52 * GAP;
  const svgHeight = 7 * SQUARE_SIZE + 6 * GAP + 16;

  return (
    <div className="flex flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">
          <span className="text-gray-12">{avgStress}</span>
          <span className="ml-1 text-sm text-gray-11">avg stress in {year}</span>
        </div>
      </div>

      <div className="relative mt-3">
        <div className="hide-scrollbar overflow-x-auto">
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            xmlns="http://www.w3.org/2000/svg"
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onMouseLeave={hideTooltip}
          >
            {Array(12)
              .fill(null)
              .map((_, month) => {
                const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
                const col = Math.ceil(
                  (86_400 * dayOffset + firstDayOfMonth.getTime() - firstDay.getTime()) /
                    604_800_000,
                );
                return (
                  <text
                    key={month}
                    x={(SQUARE_SIZE + GAP) * col}
                    y={12}
                    fontSize={12}
                    className="fill-gray-11"
                  >
                    {firstDayOfMonth.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
                  </text>
                );
              })}

            {grid.map((row, y) => (
              <Fragment key={y}>
                {row.map((day, x) => {
                  if (day === null) return null;
                  const pathD = `M${(SQUARE_SIZE + GAP) * x + 2} ${(SQUARE_SIZE + GAP) * y + 0.5 + 16}h${SQUARE_SIZE - 4}q1.5 0 1.5 1.5v${SQUARE_SIZE - 4}q0 1.5-1.5 1.5h-${SQUARE_SIZE - 4}q-1.5 0-1.5-1.5v-${SQUARE_SIZE - 4}q0-1.5 1.5-1.5z`;

                  if (day === undefined || day.stress < 0) {
                    return (
                      <path
                        key={`s-${x}-${y}`}
                        d={pathD}
                        className="fill-transparent stroke-gray-7"
                      />
                    );
                  }

                  const hasData = day.stress >= 0;
                  return (
                    <path
                      key={`s-${x}-${y}`}
                      d={pathD}
                      className={clsx(
                        'stroke-gray-7 transition-colors hover:stroke-gray-9',
                        hasData ? 'fill-orange-9' : 'fill-transparent',
                      )}
                      fillOpacity={hasData ? Math.max(0.1, day.stress / maxStress) : 0}
                      data-date={day.date}
                      data-stress={day.stress >= 0 ? Math.round(day.stress) : undefined}
                    />
                  );
                })}
              </Fragment>
            ))}
          </svg>
        </div>

        {tooltipOpen && tooltipLeft !== undefined && tooltipTop !== undefined && tooltipData !== undefined && (
          <TooltipWithBounds
            key={Math.random()}
            top={tooltipTop}
            left={tooltipLeft}
            offsetLeft={-SQUARE_SIZE}
            className="pointer-events-none absolute left-0 top-0 z-50 rounded border border-gray-6 bg-gray-3 px-2 py-1 text-sm text-gray-12 shadow-md"
            style={{}}
          >
            {(() => {
              const d = JSON.parse(tooltipData);
              return (
                <>
                  <span className="font-medium">Avg stress: {d.stress}</span>
                  <span className="ml-1 text-gray-11">on</span>{' '}
                  {new Date(d.date).toLocaleDateString('en-US', {
                    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
                  })}
                </>
              );
            })()}
          </TooltipWithBounds>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end space-x-2 text-xs text-gray-11">
        <span>Low</span>
        <svg width="68" height="12" viewBox="0 0 68 12" xmlns="http://www.w3.org/2000/svg">
          <path id="sc" d="M58 .5h8q1.5 0 1.5 1.5v8q0 1.5-1.5 1.5h-8q-1.5 0-1.5-1.5V2Q56.5.5 58 .5z" className="stroke fill-orange-9 stroke-gray-7" />
          <use xlinkHref="#sc" transform="translate(-14)" fillOpacity="0.75" />
          <use xlinkHref="#sc" transform="translate(-28)" fillOpacity="0.5" />
          <use xlinkHref="#sc" transform="translate(-42)" fillOpacity="0.25" />
          <use xlinkHref="#sc" transform="translate(-56)" fillOpacity="0.1" />
        </svg>
        <span>High</span>
      </div>
    </div>
  );
};

export default FitnessStressHeatmap;
