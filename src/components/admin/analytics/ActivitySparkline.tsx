import React from "react";
import { VIZ } from "./ColumnChart";
import { formatDay, formatDuration } from "./format";

/** A day with this much study (or more) fills the bar. Same scale for every student. */
export const SPARKLINE_FULL_SECONDS = 3600;

interface Props {
  /** Seconds per day, oldest first. */
  values: number[];
  /** Calendar days matching `values`. */
  days: string[];
  width?: number;
  height?: number;
}

/**
 * Daily study time as tiny columns. Days without study keep a baseline tick
 * so the rhythm of the fortnight stays readable. Each column carries a
 * native tooltip with the exact value.
 */
export default function ActivitySparkline({ values, days, width = 98, height = 24 }: Props) {
  const n = values.length;
  const gap = 2;
  const barW = (width - gap * (n - 1)) / n;
  const activeDays = values.filter((v) => v > 0).length;
  const total = values.reduce((sum, v) => sum + v, 0);

  return (
    <svg
      width={width}
      height={height}
      className="block shrink-0"
      role="img"
      aria-label={`Last ${n} days: studied on ${activeDays} ${activeDays === 1 ? "day" : "days"}, ${formatDuration(total)} in total`}
    >
      {values.map((v, i) => {
        const x = i * (barW + gap);
        const label = `${formatDay(days[i], true)}: ${v > 0 ? formatDuration(v) : "no study"}`;
        if (v <= 0) {
          return (
            <rect key={days[i]} x={x} y={height - 2} width={barW} height={2} rx={1} fill={VIZ.track}>
              <title>{label}</title>
            </rect>
          );
        }
        const h = Math.max(3, Math.min(1, v / SPARKLINE_FULL_SECONDS) * height);
        return (
          <rect key={days[i]} x={x} y={height - h} width={barW} height={h} rx={1.5} fill={VIZ.mark}>
            <title>{label}</title>
          </rect>
        );
      })}
    </svg>
  );
}
