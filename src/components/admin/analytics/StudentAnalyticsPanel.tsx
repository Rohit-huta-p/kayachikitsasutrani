"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Lightbulb, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import type { ActivityKind, AnalyticsRangeDays, ApiError, StudentAnalytics } from "@/lib/auth/types";
import LottieLoader from "@/components/LottieLoader";
import { ChartCard, ColumnChart, VIZ } from "./ColumnChart";
import ShlokaProgressTable from "./ShlokaProgressTable";
import { WEEKDAYS, formatDate, formatDay, formatDuration, formatHour, formatRelative } from "./format";

const RANGES: AnalyticsRangeDays[] = [7, 30, 90];

const ACTIVITY_LABELS: { kind: ActivityKind; label: string; hint: string }[] = [
  { kind: "listening", label: "Listening", hint: "Recitation or meaning audio playing" },
  { kind: "reading", label: "Reading", hint: "On a shloka, no audio or practice" },
  { kind: "typing", label: "Typing practice", hint: "Transliteration practice" },
  { kind: "drawing", label: "Drawing practice", hint: "Writing on the canvas" },
  { kind: "arranging", label: "Arrange the Sutra", hint: "Word-order game" },
  { kind: "browsing", label: "Browsing", hint: "Home, library and profile" },
];

// ── Pieces ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  delta?: { text: string; direction: "up" | "down" };
}) {
  return (
    <div className="bg-white border border-[#E5DDD0] rounded-xl p-3.5 min-w-0">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-xl sm:text-2xl font-bold text-[#1B1208] leading-tight truncate">{value}</div>
      {delta && (
        <div
          className={`mt-1 inline-flex items-center gap-0.5 text-xs ${
            delta.direction === "up" ? "text-[#006300]" : "text-[#B42318]"
          }`}
        >
          {delta.direction === "up" ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
          {delta.text}
        </div>
      )}
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function RangeSelector({ value, onChange }: { value: AnalyticsRangeDays; onChange: (d: AnalyticsRangeDays) => void }) {
  return (
    <div role="group" aria-label="Date range" className="inline-flex rounded-full border border-[#E5DDD0] bg-white p-0.5 text-xs">
      {RANGES.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={value === d}
          className={`rounded-full px-3 py-1 transition ${
            value === d ? "bg-accent text-white font-semibold" : "text-brown hover:bg-accent-soft"
          }`}
        >
          Last {d} days
        </button>
      ))}
    </div>
  );
}

/** One bar per activity, same hue (nominal categories), value at the tip. */
function ActivityBreakdown({ activity }: { activity: StudentAnalytics["activity"] }) {
  const total = ACTIVITY_LABELS.reduce((s, a) => s + activity[a.kind], 0);
  const max = Math.max(0, ...ACTIVITY_LABELS.map((a) => activity[a.kind]));
  if (total === 0) return <p className="text-sm text-gray-500 italic">No activity in this period.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {ACTIVITY_LABELS.map(({ kind, label, hint }) => {
        const v = activity[kind];
        return (
          <li key={kind} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 text-xs" title={hint}>
            <span className="text-gray-600 truncate">{label}</span>
            <span className="h-2.5 rounded-r-[4px]" aria-hidden="true">
              {v > 0 && (
                <span
                  className="block h-full rounded-r-[4px]"
                  style={{ width: `${Math.max(1.5, (v / max) * 100)}%`, background: VIZ.mark }}
                />
              )}
            </span>
            <span className="text-right text-[#1B1208] tabular-nums whitespace-nowrap">
              {formatDuration(v)} <span className="text-gray-500">· {Math.round((v / total) * 100)}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ActionStat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg bg-[#FAF7F1] px-3 py-2.5">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-bold text-[#1B1208] leading-tight">{value.toLocaleString()}</div>
      {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}

// ── Highlights: the numbers, said in words ───────────────────────────────

interface Highlight {
  tone: "warn" | "good" | "info";
  text: string;
}

/**
 * A change vs the previous period only means something when that whole
 * period was measured and the student already had an account.
 */
function hasComparablePeriod(a: StudentAnalytics): boolean {
  const joined = a.user.createdAt.slice(0, 10);
  return a.trackingSince !== null && a.trackingSince <= a.range.prevFrom && joined <= a.range.prevFrom;
}

function buildHighlights(a: StudentAnalytics): Highlight[] {
  const out: Highlight[] = [];
  const s = a.summary;

  if (!s.lastActiveAt) {
    out.push({
      tone: "warn",
      text: a.trackingSince
        ? `No activity recorded since tracking began on ${formatDay(a.trackingSince)}.`
        : "No activity recorded yet.",
    });
  } else {
    const idleDays = Math.floor((Date.now() - Date.parse(s.lastActiveAt)) / 86_400_000);
    if (idleDays >= 7) out.push({ tone: "warn", text: `Inactive for ${idleDays} days — last active ${formatDate(s.lastActiveAt)}.` });
  }

  if (hasComparablePeriod(a) && s.prevRangeSeconds >= 10 * 60) {
    const change = (s.rangeSeconds - s.prevRangeSeconds) / s.prevRangeSeconds;
    if (Math.abs(change) >= 0.25) {
      out.push({
        tone: change > 0 ? "good" : "warn",
        text: `Study time is ${change > 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 100)}% vs the previous ${a.range.days} days (${formatDuration(s.rangeSeconds)} vs ${formatDuration(s.prevRangeSeconds)}).`,
      });
    }
  }

  const stuck = a.shlokas
    .filter((r) => r.available && r.status === "in-progress" && r.totalSeconds >= 20 * 60)
    .sort((x, y) => y.totalSeconds - x.totalSeconds)[0];
  if (stuck) {
    out.push({ tone: "warn", text: `Has spent ${formatDuration(stuck.totalSeconds)} on “${stuck.title}” without completing it yet.` });
  }

  const hourTotal = a.hourly.reduce((x, y) => x + y, 0);
  if (hourTotal >= 30 * 60) {
    let best = 0;
    let bestStart = 0;
    for (let h = 0; h < 24; h++) {
      const sum = a.hourly[h] + a.hourly[(h + 1) % 24] + a.hourly[(h + 2) % 24];
      if (sum > best) {
        best = sum;
        bestStart = h;
      }
    }
    const share = best / hourTotal;
    if (share >= 0.4) {
      out.push({
        tone: "info",
        text: `Studies mostly between ${formatHour(bestStart)} and ${formatHour((bestStart + 3) % 24)} (${Math.round(share * 100)}% of their time).`,
      });
    }
  }

  const practice = a.activity.typing + a.activity.drawing + a.activity.arranging;
  if (s.rangeSeconds >= 30 * 60 && practice / s.rangeSeconds < 0.05) {
    out.push({ tone: "info", text: "Rarely uses the practice tools (type, draw, arrange); mostly listens and reads." });
  }

  const notStarted = a.shlokas.filter((r) => r.available && r.status === "not-started").length;
  if (notStarted > 0) out.push({ tone: "info", text: `Hasn't opened ${notStarted} of ${s.available} shlokas yet.` });

  return out.slice(0, 4);
}

const TONE = {
  warn: { Icon: AlertTriangle, className: "text-[#B45309]" },
  good: { Icon: TrendingUp, className: "text-[#006300]" },
  info: { Icon: Lightbulb, className: "text-brown" },
};

function Highlights({ items }: { items: Highlight[] }) {
  return (
    <section className="bg-white border border-[#E5DDD0] rounded-xl p-4">
      <h3 className="text-sm font-bold text-brown mb-2">Highlights</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((h) => {
          const { Icon, className } = TONE[h.tone];
          return (
            <li key={h.text} className="flex items-start gap-2 text-sm text-[#1B1208]">
              <Icon size={15} className={`mt-0.5 shrink-0 ${className}`} aria-hidden="true" />
              <span>{h.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────

function mainDevice(devices: StudentAnalytics["summary"]["devices"]): string | null {
  const total = devices.mobile + devices.tablet + devices.desktop;
  if (total === 0) return null;
  const [name, secs] = (Object.entries(devices) as [string, number][]).sort((x, y) => y[1] - x[1])[0];
  return `${Math.round((secs / total) * 100)}% on ${name}`;
}

export default function StudentAnalyticsPanel({ studentId }: { studentId: string }) {
  const [days, setDays] = useState<AnalyticsRangeDays>(30);
  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    api.admin.analytics
      .student(studentId, { days, tz })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch((e: ApiError) => {
        if (!cancelled) setError(e.message || "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, days]);

  if (!data) {
    if (error) return <p className="text-sm text-red-600">{error}</p>;
    return <LottieLoader />;
  }

  const s = data.summary;
  const highlights = buildHighlights(data);
  const rangeLabel = `last ${data.range.days} days`;
  const diff = s.rangeSeconds - s.prevRangeSeconds;
  const delta =
    hasComparablePeriod(data) && diff !== 0
      ? {
          direction: diff > 0 ? ("up" as const) : ("down" as const),
          text: `${formatDuration(Math.abs(diff))} vs previous ${data.range.days} days`,
        }
      : undefined;
  const device = mainDevice(s.devices);

  const daily = data.daily.map((d) => ({
    key: d.day,
    value: d.seconds,
    label: formatDay(d.day),
    title: formatDay(d.day, true),
  }));
  const hourly = data.hourly.map((v, h) => ({
    key: String(h),
    value: v,
    label: formatHour(h),
    title: `${formatHour(h)} – ${formatHour((h + 1) % 24)}`,
  }));
  const weekday = data.weekday.map((v, i) => ({ key: WEEKDAYS[i], value: v, label: WEEKDAYS[i], title: WEEKDAYS[i] }));
  const asTable = (rows: { title: string; value: number }[]) => rows.map((r) => ({ label: r.title, value: formatDuration(r.value) }));

  return (
    <div className="flex flex-col gap-4">
      {/* All time */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Total time spent"
          value={formatDuration(s.totalSeconds)}
          sub={data.trackingSince ? `Since tracking began ${formatDay(data.trackingSince)}` : "No activity tracked yet"}
        />
        <StatTile
          label="Shlokas completed"
          value={`${s.completed} of ${s.available}`}
          sub={`${s.inProgress} in progress`}
        />
        <StatTile
          label="Current streak"
          value={`${s.currentStreak} ${s.currentStreak === 1 ? "day" : "days"}`}
          sub={`Best: ${s.longestStreak} ${s.longestStreak === 1 ? "day" : "days"}`}
        />
        <StatTile
          label="Last active"
          value={formatRelative(s.lastActiveAt)}
          sub={data.user.lastLoginAt ? `Last login ${formatDate(data.user.lastLoginAt)}` : "Never logged in"}
        />
      </div>

      {highlights.length > 0 && <Highlights items={highlights} />}

      {/* Range-scoped activity — the filter scopes everything in this block */}
      <section className={`rounded-2xl border border-[#E5DDD0] bg-[#FBF8F2] p-3 md:p-4 flex flex-col gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold text-brown">Activity</h2>
          <RangeSelector value={days} onChange={setDays} />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile label={`Time spent, ${rangeLabel}`} value={formatDuration(s.rangeSeconds)} delta={delta} />
          <StatTile
            label="Active days"
            value={`${s.activeDays} of ${data.range.days}`}
            sub={s.activeDays > 0 ? `${formatDuration(s.rangeSeconds / s.activeDays)} per active day` : "No day with 1m+ of study"}
          />
          <StatTile
            label="Study sessions"
            value={String(s.rangeSessions)}
            sub={
              s.rangeSessions > 0
                ? `${formatDuration(s.avgSessionSeconds)} on average${device ? ` · ${device}` : ""}`
                : "No sessions in this period"
            }
          />
        </div>

        <ChartCard
          title="Time spent per day"
          subtitle={`${formatDay(data.range.from)} – ${formatDay(data.range.to)}`}
          table={asTable(daily)}
        >
          <ColumnChart data={daily} ariaLabel={`Time spent per day, ${rangeLabel}`} plotHeight={150} />
        </ChartCard>

        <div className="grid md:grid-cols-2 gap-3">
          <ChartCard title="How the time was spent" subtitle="Each active second counts once">
            <ActivityBreakdown activity={data.activity} />
          </ChartCard>
          <ChartCard title="Practice & listening actions">
            <div className="grid grid-cols-2 gap-2">
              <ActionStat
                label="Recitation plays"
                value={data.actions.audioPlays}
                sub={`${data.actions.audioCompletes} full run-throughs`}
              />
              <ActionStat label="Meaning audio plays" value={data.actions.meaningPlays} />
              <ActionStat label="Typing checks" value={data.actions.typeChecks} />
              <ActionStat
                label="Arrange checks"
                value={data.actions.arrangeChecks}
                sub={`${data.actions.arrangeSolves} solved`}
              />
            </div>
          </ChartCard>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <ChartCard
            className="md:col-span-2"
            title="Time of day"
            subtitle="Student's local time"
            table={asTable(hourly)}
          >
            <ColumnChart
              data={hourly}
              ariaLabel={`Time spent by hour of day, ${rangeLabel}`}
              labelAnchor="start"
              labelStrides={[1, 2, 3, 4, 6, 12]}
            />
          </ChartCard>
          <ChartCard title="Day of week" table={asTable(weekday)}>
            <ColumnChart
              data={weekday}
              ariaLabel={`Time spent by day of week, ${rangeLabel}`}
              labelAnchor="start"
              labelStrides={[1]}
            />
          </ChartCard>
        </div>
      </section>

      {/* All time, per shloka */}
      <section className="bg-white border border-[#E5DDD0] rounded-xl p-4">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-brown">Progress by shloka</h2>
          <span className="text-xs text-gray-500">All time</span>
        </div>
        <ShlokaProgressTable rows={data.shlokas} />
      </section>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Time counts while the app is on screen and the student has interacted in the last 2 minutes, or audio is playing.
        An active day has at least 1 minute of study.
      </p>
    </div>
  );
}
