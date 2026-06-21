import {
  type FC,
  Fragment,
  type PointerEvent,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { TooltipWithBounds, useTooltip, useTooltipInPortal } from '@visx/tooltip';
import clsx from 'clsx';

import { Select } from '@/components/ui';

const SQUARE_SIZE = 12;
const GAP = 2;

type RunningFeatureDetailHeatmapProps = {
  runningLogs: MileageLog[];
};

const RunningFeatureDetailHeatmap: FC<RunningFeatureDetailHeatmapProps> = ({ runningLogs }) => {
  const yearsLogged = useMemo(
    () =>
      Array.from(new Set(runningLogs.map((log) => new Date(log.date).getFullYear())))
        .sort()
        .reverse(),
    [runningLogs],
  );

  const [year, setYear] = useState<number>(yearsLogged[0]);

  const { containerRef, containerBounds } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
  });

  const { showTooltip, hideTooltip, tooltipOpen, tooltipLeft, tooltipTop, tooltipData } =
    useTooltip<string>({ tooltipOpen: false });

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const tooltipLeft = ('clientX' in event ? event.clientX : 0) - containerBounds.left;
      const tooltipTop = ('clientY' in event ? event.clientY : 0) - containerBounds.top;
      const target = event.target as SVGPathElement;
      const dataDate = target.getAttribute('data-date') ?? undefined;
      const dataCount = target.getAttribute('data-count') ?? undefined;
      const data =
        dataDate !== undefined && dataCount !== undefined
          ? JSON.stringify({ date: dataDate, count: dataCount })
          : undefined;
      showTooltip({ tooltipLeft, tooltipTop, tooltipData: data });
    },
    [containerBounds.left, containerBounds.top, showTooltip],
  );

  const firstDay = useMemo(() => new Date(Date.UTC(year, 0, 1)), [year]);
  const dayOffset = useMemo(() => firstDay.getUTCDay(), [firstDay]);

  const filteredLogs = useMemo(
    () => runningLogs.filter((log) => new Date(log.date).getUTCFullYear() === year),
    [runningLogs, year],
  );

  const totalActivities = useMemo(() => filteredLogs.reduce((sum, l) => sum + l.value, 0), [filteredLogs]);

  const maxCount = useMemo(
    () => Math.max(1, ...filteredLogs.map((l) => l.value)),
    [filteredLogs],
  );

  const logs = useMemo(() => {
    const logByDate = new Map<string, MileageLog>();
    for (const log of filteredLogs) {
      logByDate.set(log.date.slice(0, 10), log);
    }

    const days: (MileageLog | null | undefined)[][] = Array(7)
      .fill(null)
      .map(() => new Array(53).fill(null));

    const daysInYear = year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0) ? 366 : 365;
    const date = new Date(Date.UTC(year, 0, 1));

    for (let i = 0; i < daysInYear; i++) {
      const dow = date.getUTCDay();
      const col = Math.floor((i + dayOffset) / 7);
      const key = date.toISOString().slice(0, 10);
      days[dow][col] = logByDate.get(key) ?? undefined;
      date.setUTCDate(date.getUTCDate() + 1);
    }

    return days;
  }, [dayOffset, filteredLogs, year]);

  const width = useMemo(() => 53 * SQUARE_SIZE + 52 * GAP, []);
  const height = useMemo(() => 7 * SQUARE_SIZE + 6 * GAP + 16, []);

  return (
    <div className="flex h-full flex-col p-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">
          <span className="text-gray-12">{totalActivities}</span>
          <span className="ml-1 text-xs text-gray-11">activities in {year}</span>
        </div>
        <Select
          size="sm"
          variant="primary"
          intent="none"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          aria-label="Select year"
        >
          {yearsLogged.map((y) => (
            <Select.Item key={y}>{y}</Select.Item>
          ))}
        </Select>
      </div>

      <div className="relative mt-2">
        <div className="hide-scrollbar overflow-x-auto">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
            role="figure"
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onMouseLeave={hideTooltip}
          >
            <desc>Kent Miguel&apos;s activity heatmap for {year}</desc>
            {Array(12)
              .fill(null)
              .map((_, month) => {
                const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
                return (
                  <text
                    key={month}
                    x={
                      (SQUARE_SIZE + GAP) *
                      Math.ceil(
                        (86_400 * dayOffset + firstDayOfMonth.getTime() - firstDay.getTime()) /
                          604_800_000,
                      )
                    }
                    y={12}
                    fontSize={12}
                    className="fill-gray-11"
                  >
                    {firstDayOfMonth.toLocaleDateString('en-US', {
                      month: 'short',
                      timeZone: 'UTC',
                    })}
                  </text>
                );
              })}

            {logs.map((row, y) => (
              <Fragment key={y}>
                {row.map((day, x) => {
                  if (day === null) return null;
                  const pathD = `M${(SQUARE_SIZE + GAP) * x + 2} ${(SQUARE_SIZE + GAP) * y + 0.5 + 16}h${SQUARE_SIZE - 4}q1.5 0 1.5 1.5v${SQUARE_SIZE - 4}q0 1.5-1.5 1.5h-${SQUARE_SIZE - 4}q-1.5 0-1.5-1.5v-${SQUARE_SIZE - 4}q0-1.5 1.5-1.5z`;

                  if (day === undefined) {
                    return <path key={`h-${x}-${y}`} d={pathD} className="fill-transparent stroke stroke-gray-7" />;
                  }

                  return (
                    <path
                      key={`h-${x}-${y}`}
                      d={pathD}
                      className={clsx(
                        'stroke stroke-gray-7 transition-colors hover:stroke-gray-8',
                        day.value > 0 ? 'fill-green-9' : 'fill-transparent',
                      )}
                      fillOpacity={day.value > 0 ? Math.min(1, day.value / maxCount) : 0}
                      data-date={day.date}
                      data-count={day.value}
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
            className="pointer-events-none absolute left-0 top-0 z-50 rounded border border-gray-6 bg-gray-3 px-2 py-1 text-sm text-gray-12 shadow-md transition-colors"
            style={{}}
          >
            {(() => {
              const d = JSON.parse(tooltipData);
              const count = Number(d.count);
              return (
                <>
                  <span className="font-medium">{count} {count === 1 ? 'activity' : 'activities'}</span>
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

      <div className="flex grow items-end justify-end space-x-2">
        <div className="flex items-center space-x-1 text-xs text-gray-11">
          <span>Less</span>
          <svg width="68" height="12" viewBox="0 0 68 12" xmlns="http://www.w3.org/2000/svg" role="note">
            <path
              id="b"
              d="M58 .5h8q1.5 0 1.5 1.5v8q0 1.5-1.5 1.5h-8q-1.5 0-1.5-1.5V2Q56.5.5 58 .5z"
              className="stroke fill-green-9 stroke-gray-7"
            />
            <use xlinkHref="#b" transform="translate(-14)" fillOpacity="0.75" />
            <use xlinkHref="#b" transform="translate(-28)" fillOpacity="0.5" />
            <use xlinkHref="#b" transform="translate(-42)" fillOpacity="0.25" />
            <use xlinkHref="#b" transform="translate(-56)" fillOpacity="0" />
          </svg>
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

export default RunningFeatureDetailHeatmap;
