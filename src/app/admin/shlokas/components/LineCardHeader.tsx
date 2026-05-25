"use client";

import React from "react";

export type LineStatus = "done" | "warn" | "empty";

interface Props {
  index: number;
  status: LineStatus;
  /** Color stripe (line color, rgba). */
  stripeColor: string;
  /** Sanskrit preview (truncated by CSS). */
  sanskritPreview: string;
  /** Small stats — e.g. "2/2 words · full: 2/2" or "no audio yet" */
  stats: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

const STATUS_GLYPH: Record<LineStatus, string> = { done: "✓", warn: "⚠", empty: "◯" };
const STATUS_CLASS: Record<LineStatus, string> = {
  done: "status-icon status-done",
  warn: "status-icon status-warn anim-ring-pulse",
  empty: "status-icon status-empty",
};
const LABEL_CLASS: Record<LineStatus, string> = {
  done: "font-semibold text-sm",
  warn: "font-semibold text-sm",
  empty: "font-semibold text-sm text-gray-500",
};
const STATS_CLASS: Record<LineStatus, string> = {
  done: "text-xs text-gray-500",
  warn: "text-xs text-amber-700",
  empty: "text-xs text-gray-400",
};

const LineCardHeader: React.FC<Props> = ({
  index,
  status,
  stripeColor,
  sanskritPreview,
  stats,
  expanded,
  onToggle,
  onRemove,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`Line ${index + 1}, ${status === "done" ? "complete" : status === "warn" ? "needs attention" : "empty"}, click to ${expanded ? "collapse" : "expand"}`}
      className="w-full flex items-center p-3 text-left"
    >
      <span className="self-stretch w-1 mr-3 rounded-sm" style={{ background: stripeColor }} aria-hidden="true" />
      <svg
        className={`chev-rotate w-4 h-4 text-gray-400 mr-2 ${expanded ? "is-open" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
      <span className={STATUS_CLASS[status]} aria-hidden="true">{STATUS_GLYPH[status]}</span>
      <div className="flex-1 min-w-0 ml-3">
        <div className="flex items-center gap-2">
          <span className={LABEL_CLASS[status]}>Line {index + 1}</span>
          <span className={STATS_CLASS[status]}>{stats}</span>
        </div>
        <div className={status === "empty" ? "text-sm text-gray-400 italic truncate" : "text-sm text-gray-700 truncate"}>
          {sanskritPreview || (status === "empty" ? "— upload line audio to start —" : "")}
        </div>
      </div>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); onRemove(); } }}
        className="text-xs text-red-500 hover:text-red-700 ml-3 cursor-pointer"
      >
        Remove
      </span>
    </button>
  );
};

export default LineCardHeader;
