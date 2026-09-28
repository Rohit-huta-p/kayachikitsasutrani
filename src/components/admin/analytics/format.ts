/** Formatting helpers shared by the admin analytics views. */

/** 0 → "0m", 45 → "45s", 754 → "13m", 7980 → "2h 13m". */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Compact axis label: "0", "15m", "1h", "1.5h". */
export function formatAxisDuration(seconds: number): string {
  if (seconds <= 0) return "0";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = seconds / 3600;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

const TICK_STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600, 43200];

/** Round axis ticks for a duration scale: at most ~4 intervals, ending at or above `max`. */
export function durationTicks(max: number): number[] {
  const step = TICK_STEPS.find((s) => max / s <= 4) ?? Math.ceil(max / 4 / 3600) * 3600;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return ticks;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago". Units step up once rounding reaches the next one. */
export function formatRelative(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const diffSec = (new Date(iso).getTime() - now) / 1000;
  if (Math.abs(diffSec) < 60) return "just now";
  const minutes = Math.round(diffSec / 60);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(diffSec / 3600);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  const days = Math.round(diffSec / 86_400);
  if (Math.abs(days) < 7) return relative.format(days, "day");
  if (Math.abs(days) < 30) return relative.format(Math.round(days / 7), "week");
  return relative.format(Math.round(days / 30), "month");
}

/** Calendar day string ("2026-09-28") → "Sep 28" (or "Sep 28, 2025" outside this year). */
export function formatDay(day: string, withWeekday = false): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}),
    ...(withWeekday ? { weekday: "short" } : {}),
  });
}

/** Timestamp → local "Sep 28" (or "Sep 28, 2025" outside this year). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

/** 0 → "12 AM", 13 → "1 PM". */
export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
