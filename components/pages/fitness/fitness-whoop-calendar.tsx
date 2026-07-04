import {
  Fragment,
  type FC,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useMemo,
} from 'react';

import { TooltipWithBounds, useTooltip, useTooltipInPortal } from '@visx/tooltip';

const SQUARE_SIZE = 12;
const GAP = 2;

type Cell = { date: string; value: number } | null | undefined;

export type TooltipRow = { label: string; value: string; color?: string };

/**
 * Shared GitHub-style calendar heatmap for WHOOP metrics. Cells are coloured
 * by `colorFor(value)`; days with no reading render as empty outlines. Mirrors
 * the grid maths used by the Garmin stress/sleep heatmaps.
 */
const FitnessWhoopCalendar: FC<{
  valueByDate: Record<string, number>;
  colorFor: (value: number) => string;
  avgText: (avg: number | null) => string;
  tooltipRows: (date: string) => TooltipRow[];
  legend: ReactNode;
}> = ({ valueByDate, colorFor, avgText, tooltipRows, legend }) => {
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
      if (dataDate === undefined) return;
      showTooltip({ tooltipLeft: tLeft, tooltipTop: tTop, tooltipData: dataDate });
    },
    [containerBounds.left, containerBounds.top, showTooltip],
  );

  const firstDay = useMemo(() => new Date(Date.UTC(year, 0, 1)), [year]);
  const dayOffset = useMemo(() => firstDay.getUTCDay(), [firstDay]);

  const grid = useMemo(() => {
    const rows: Cell[][] = Array(7)
      .fill(null)
      .map(() => new Array(53).fill(null));
    const date = new Date(Date.UTC(year, 0, 1));
    const daysInYear = year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0) ? 366 : 365;
    for (let i = 0; i < daysInYear; i++) {
      const dow = date.getUTCDay();
      const col = Math.floor(i / 7) + (date.getUTCDay() < dayOffset ? 1 : 0);
      const key = date.toISOString().slice(0, 10);
      const value = valueByDate[key];
      rows[dow][col] = { date: key, value: value ?? -1 };
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return rows;
  }, [year, dayOffset, valueByDate]);

  const avg = useMemo(() => {
    const vals = Object.values(valueByDate);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }, [valueByDate]);

  const svgWidth = 53 * SQUARE_SIZE + 52 * GAP;
  const svgHeight = 7 * SQUARE_SIZE + 6 * GAP + 16;

  return (
    <div className="flex flex-col p-4">
      <div className="font-medium">
        <span className="text-gray-12">{avgText(avg)}</span>
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

                  if (day === undefined || day.value < 0) {
                    return <path key={`c-${x}-${y}`} d={pathD} className="fill-transparent stroke-gray-7" />;
                  }

                  return (
                    <path
                      key={`c-${x}-${y}`}
                      d={pathD}
                      className="stroke-gray-7 transition-colors hover:stroke-gray-9"
                      fill={colorFor(day.value)}
                      data-date={day.date}
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
            <div className="flex flex-col gap-0.5">
              <div className="font-medium text-gray-12">
                {new Date(tooltipData).toLocaleDateString('en-US', {
                  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
                })}
              </div>
              {tooltipRows(tooltipData).map((row) => (
                <div key={row.label} className="flex items-center gap-1 text-gray-11">
                  <span className="w-20 text-xs">{row.label}</span>
                  <span className="font-medium" style={row.color ? { color: row.color } : undefined}>{row.value}</span>
                </div>
              ))}
            </div>
          </TooltipWithBounds>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 text-xs text-gray-11">{legend}</div>
    </div>
  );
};

export default FitnessWhoopCalendar;
