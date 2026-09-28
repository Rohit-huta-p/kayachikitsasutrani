"use client";

import React, { useEffect, useRef, useState } from "react";
import { durationTicks, formatAxisDuration, formatDuration } from "./format";

/** Chart ink — brand brown stepped to clear the chroma floor and 3:1 on white. */
export const VIZ = {
  mark: "#B07236",
  markActive: "#8F5827",
  track: "#F4E8DA",
  hoverWash: "#FBF6EF",
  grid: "#F0E7D8",
  axis: "#D9CCB8",
  tick: "#6B7280",
} as const;

export interface ColumnDatum {
  key: string;
  /** Seconds. */
  value: number;
  /** Short x-axis label. */
  label: string;
  /** Full label for the tooltip and table view. */
  title: string;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  ariaLabel: string;
  plotHeight?: number;
  /** Which end always keeps its x label when labels are thinned out. */
  labelAnchor?: "start" | "end";
  /** Allowed label strides, e.g. [1, 2, 3, 6] for hours; any stride when omitted. */
  labelStrides?: number[];
}

const PAD = { top: 10, right: 4, bottom: 22, left: 38 };
const LABEL_GAP = 12;
const MAX_BAR = 24;

function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Column with a 4px rounded data-end, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Single-series column chart of durations. Every column's full slot is its
 * hover target; arrow keys walk the columns when the chart has focus.
 */
export function ColumnChart({ data, ariaLabel, plotHeight = 140, labelAnchor = "end", labelStrides }: ColumnChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const n = data.length;
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = durationTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(1, Math.min(MAX_BAR, slot - 2));
  const height = PAD.top + plotHeight + PAD.bottom;
  const y = (v: number) => PAD.top + plotHeight - (v / top) * plotHeight;

  // ~6px per character at 10px, plus breathing room between neighbours.
  const labelSpacing = Math.max(1, ...data.map((d) => d.label.length)) * 6 + LABEL_GAP;
  const minStride = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / labelSpacing))));
  const stride = labelStrides?.find((s) => s >= minStride) ?? minStride;
  const showLabel = (i: number) => (labelAnchor === "end" ? (n - 1 - i) % stride === 0 : i % stride === 0);

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - PAD.left;
    if (x < 0 || x > plotW || slot === 0) return setActive(null);
    setActive(Math.min(n - 1, Math.floor(x / slot)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setActive((cur) => (cur === null ? n - 1 : Math.min(n - 1, Math.max(0, cur + step))));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : n - 1);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  const activeDatum = active !== null ? data[active] : null;
  const tooltipLeft = active !== null ? Math.min(Math.max(PAD.left + (active + 0.5) * slot, 64), width - 64) : 0;
  const tooltipTop = activeDatum ? Math.max(0, y(activeDatum.value) - 8) : 0;

  return (
    <div
      ref={wrapRef}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      role="group"
      aria-label={`${ariaLabel}. Use the left and right arrow keys to read each value.`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block touch-pan-y"
          aria-hidden="true"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? VIZ.axis : VIZ.grid}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={PAD.left - 6}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill={VIZ.tick}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatAxisDuration(t)}
              </text>
            </g>
          ))}

          {active !== null && (
            <rect x={PAD.left + active * slot} y={PAD.top} width={slot} height={plotHeight} fill={VIZ.hoverWash} />
          )}

          {data.map((d, i) => {
            if (d.value <= 0) return null;
            const h = Math.max(2, (d.value / top) * plotHeight);
            const x = PAD.left + i * slot + (slot - barW) / 2;
            return (
              <path
                key={d.key}
                d={columnPath(x, PAD.top + plotHeight - h, barW, h)}
                fill={i === active ? VIZ.markActive : VIZ.mark}
              />
            );
          })}

          {data.map((d, i) =>
            showLabel(i) ? (
              <text
                key={d.key}
                x={PAD.left + (i + 0.5) * slot}
                y={height - 6}
                textAnchor={i === n - 1 && labelAnchor === "end" && n > 1 ? "end" : "middle"}
                dx={i === n - 1 && labelAnchor === "end" && n > 1 ? slot / 2 : 0}
                fontSize={10}
                fill={VIZ.tick}
              >
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {width === 0 && <div style={{ height }} />}

      {activeDatum && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-white px-2.5 py-1.5 text-center shadow-md ring-1 ring-black/10 whitespace-nowrap"
          style={{ left: tooltipLeft, top: tooltipTop }}
        >
          <div className="text-sm font-bold text-[#1B1208]">{formatDuration(activeDatum.value)}</div>
          <div className="text-[11px] text-gray-500">{activeDatum.title}</div>
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {activeDatum ? `${activeDatum.title}: ${formatDuration(activeDatum.value)}` : ""}
      </div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Rows for the table view — the accessible twin of the chart. */
  table?: { label: string; value: string }[];
  className?: string;
  children: React.ReactNode;
}

/** Card wrapper with a title and a chart ⇄ table toggle. */
export function ChartCard({ title, subtitle, table, className = "", children }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`bg-white border border-[#E5DDD0] rounded-xl p-4 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-brown">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="shrink-0 text-[11px] text-gray-500 hover:text-[#1B1208] border border-[#E5DDD0] rounded-full px-2.5 py-0.5 transition"
          >
            {showTable ? "Chart" : "Table"}
          </button>
        )}
      </div>
      {showTable && table ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {table.map((r) => (
                <tr key={r.label} className="border-b border-[#F0E7D8] last:border-b-0">
                  <td className="py-1.5 text-gray-600">{r.label}</td>
                  <td className="py-1.5 text-right text-[#1B1208] tabular-nums">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
