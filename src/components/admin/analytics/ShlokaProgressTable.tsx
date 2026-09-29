"use client";

import React, { useState } from "react";
import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import type { ShlokaAnalyticsRow } from "@/lib/auth/types";
import { VIZ } from "./ColumnChart";
import { formatDate, formatDuration, formatRelative } from "./format";

const STATUS: Record<ShlokaAnalyticsRow["status"], { label: string; className: string; Icon: typeof Circle }> = {
  completed: { label: "Completed", className: "bg-green-50 text-green-800 border-green-200", Icon: CheckCircle2 },
  "in-progress": { label: "In progress", className: "bg-accent-soft text-[#8A5A2B] border-[#F0DDC2]", Icon: Clock3 },
  "not-started": { label: "Not started", className: "bg-gray-50 text-gray-500 border-gray-200", Icon: Circle },
};

function StatusBadge({ status }: { status: ShlokaAnalyticsRow["status"] }) {
  const { label, className, Icon } = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${className}`}>
      <Icon size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Time spent with a same-hue meter scaled to the student's busiest shloka. */
function TimeMeter({ seconds, max }: { seconds: number; max: number }) {
  const pct = max > 0 ? (seconds / max) * 100 : 0;
  return (
    <div className="min-w-[96px]">
      <div className="text-sm text-[#1B1208] tabular-nums">{formatDuration(seconds)}</div>
      <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: VIZ.track }} aria-hidden="true">
        {seconds > 0 && (
          <div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: VIZ.mark }} />
        )}
      </div>
    </div>
  );
}

function practiceSummary(r: ShlokaAnalyticsRow): string {
  const parts: string[] = [];
  if (r.typeChecks > 0) parts.push(`typing best ${r.typeBestPct}%`);
  if (r.arrangeChecks > 0) parts.push(`arranged ${r.arrangeSolves}/${r.arrangeChecks}`);
  return parts.join(" · ");
}

function completionSummary(r: ShlokaAnalyticsRow): string {
  if (!r.completion) return "";
  const c = r.completion;
  return `${c.attempts} ${c.attempts === 1 ? "attempt" : "attempts"} · took ${formatDuration(c.elapsedSeconds)}`;
}

function Title({ row }: { row: ShlokaAnalyticsRow }) {
  return (
    <>
      <span className="font-semibold text-[#1B1208]">{row.title}</span>
      {!row.available && <span className="ml-1.5 text-[10px] text-gray-400">(no longer assigned)</span>}
    </>
  );
}

export default function ShlokaProgressTable({ rows }: { rows: ShlokaAnalyticsRow[] }) {
  const [showNotStarted, setShowNotStarted] = useState(false);
  const started = rows.filter((r) => r.status !== "not-started");
  const notStarted = rows.filter((r) => r.status === "not-started");
  const max = Math.max(0, ...rows.map((r) => r.totalSeconds));

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 italic">No published shlokas yet.</p>;
  }

  const notStartedToggle = notStarted.length > 0 && (
    <div className="mt-3 text-xs text-gray-500">
      <button
        type="button"
        onClick={() => setShowNotStarted((v) => !v)}
        aria-expanded={showNotStarted}
        className="font-semibold text-brown hover:underline"
      >
        {showNotStarted ? "Hide" : "Show"} {notStarted.length} not started
      </button>
      {showNotStarted && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {notStarted.map((r) => (
            <li key={r.shlokaId} className="rounded-full border border-[#E5DDD0] bg-[#FAF7F1] px-2.5 py-0.5 text-[#1B1208]">
              {r.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div>
      {started.length === 0 && (
        <p className="text-sm text-gray-500 italic">Hasn&apos;t opened or completed any shloka yet.</p>
      )}

      {/* Desktop table */}
      {started.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-[#E5DDD0]">
                <th className="py-2 pr-3 font-normal">Shloka</th>
                <th className="py-2 pr-3 font-normal">Status</th>
                <th className="py-2 pr-3 font-normal">Time spent</th>
                <th className="py-2 pr-3 font-normal">Listening</th>
                <th className="py-2 pr-3 font-normal">Practice</th>
                <th className="py-2 pr-3 font-normal">Completed</th>
                <th className="py-2 pr-3 font-normal">Rank</th>
                <th className="py-2 font-normal">Last active</th>
              </tr>
            </thead>
            <tbody>
              {started.map((r) => (
                <tr key={r.shlokaId} className="border-b border-[#F0E7D8] last:border-b-0 align-top">
                  <td className="py-2.5 pr-3 max-w-[220px]"><Title row={r} /></td>
                  <td className="py-2.5 pr-3"><StatusBadge status={r.status} /></td>
                  <td className="py-2.5 pr-3"><TimeMeter seconds={r.totalSeconds} max={max} /></td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    <div className="text-[#1B1208]">{formatDuration(r.listeningSeconds)}</div>
                    <div className="text-[11px] text-gray-500">
                      {r.audioPlays} {r.audioPlays === 1 ? "play" : "plays"} · {r.audioCompletes} full
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    <div className="text-[#1B1208]">{formatDuration(r.practiceSeconds)}</div>
                    <div className="text-[11px] text-gray-500">{practiceSummary(r) || "—"}</div>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {r.completion ? (
                      <>
                        <div className="text-[#1B1208]">{formatDate(r.completion.completedAt)}</div>
                        <div className="text-[11px] text-gray-500">{completionSummary(r)}</div>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums whitespace-nowrap">
                    {r.completion ? (
                      <span className="text-[#1B1208]">
                        #{r.completion.rank} <span className="text-gray-500">of {r.completion.totalCompletions}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-gray-600 whitespace-nowrap">
                    {r.lastActiveAt ? formatRelative(r.lastActiveAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {started.length > 0 && (
        <ul className="md:hidden flex flex-col gap-2">
          {started.map((r) => {
            const practice = practiceSummary(r);
            return (
              <li key={r.shlokaId} className="rounded-lg border border-[#F0E7D8] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm min-w-0"><Title row={r} /></div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-2"><TimeMeter seconds={r.totalSeconds} max={max} /></div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <dt className="text-gray-500">Listening</dt>
                  <dd className="text-right text-[#1B1208] tabular-nums">
                    {formatDuration(r.listeningSeconds)} · {r.audioPlays} {r.audioPlays === 1 ? "play" : "plays"}
                  </dd>
                  <dt className="text-gray-500">Practice</dt>
                  <dd className="text-right text-[#1B1208] tabular-nums">
                    {formatDuration(r.practiceSeconds)}{practice ? ` · ${practice}` : ""}
                  </dd>
                  {r.completion && (
                    <>
                      <dt className="text-gray-500">Completed</dt>
                      <dd className="text-right text-[#1B1208] tabular-nums">
                        {formatDate(r.completion.completedAt)} · #{r.completion.rank} of {r.completion.totalCompletions}
                      </dd>
                    </>
                  )}
                  <dt className="text-gray-500">Last active</dt>
                  <dd className="text-right text-[#1B1208]">{r.lastActiveAt ? formatRelative(r.lastActiveAt) : "—"}</dd>
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      {notStartedToggle}
    </div>
  );
}
