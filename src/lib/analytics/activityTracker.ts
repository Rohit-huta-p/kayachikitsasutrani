/**
 * Student engagement tracker behind the admin analytics.
 *
 * A second counts as "active" when the tab is visible and either audio is
 * playing or the student has interacted (tap, key, scroll, pointer) within
 * the last 2 minutes. Each active second is attributed to one activity:
 * a practice widget they're working in (marked with `data-activity`),
 * else listening while audio plays, else reading (on a shloka) or browsing.
 *
 * Seconds and practice actions are summed per local day/hour + current
 * shloka and flushed to `/api/activity` every 30s and whenever the tab is
 * hidden. Only these aggregates leave the browser — never typed text or
 * drawings.
 */

export type Activity = "listening" | "reading" | "typing" | "drawing" | "arranging" | "browsing";
export type ActivityCounter =
  | "audioPlays"
  | "audioCompletes"
  | "meaningPlays"
  | "typeChecks"
  | "arrangeChecks"
  | "arrangeSolves";

type Device = "mobile" | "tablet" | "desktop";

interface Entry {
  day: string;
  hour: number;
  slug: string | null;
  seconds: Record<Activity, number>;
  counts: Record<ActivityCounter, number>;
  typeBestPct?: number;
}

const TICK_MS = 1_000;
const FLUSH_MS = 30_000;
/** No input for this long (and no audio) = the student stepped away. */
const IDLE_AFTER_MS = 2 * 60_000;
/** A practice widget keeps the credit this long after the last input inside it. */
const PRACTICE_FOCUS_MS = 30_000;
/** A new session starts after this long without any active second. */
const SESSION_GAP_MS = 30 * 60_000;
/** A throttled or suspended tab never back-fills more than this per tick. */
const MAX_TICK_MS = 2_000;
/** Server accepts at most this many entries per flush. */
const MAX_ENTRIES_PER_FLUSH = 50;
const MAX_PENDING_ENTRIES = 200;
const SESSION_KEY = "cs.activity.session";

const ACTIVITIES: Activity[] = ["listening", "reading", "typing", "drawing", "arranging", "browsing"];
const COUNTERS: ActivityCounter[] = [
  "audioPlays",
  "audioCompletes",
  "meaningPlays",
  "typeChecks",
  "arrangeChecks",
  "arrangeSolves",
];
const PRACTICE_AREAS = new Set<string>(["typing", "drawing", "arranging"]);
const DISCRETE_INPUTS = new Set(["pointerdown", "keydown", "touchstart"]);
const INPUT_EVENTS = ["pointerdown", "keydown", "touchstart", "pointermove", "wheel", "scroll"];

const pad = (n: number) => String(n).padStart(2, "0");

function detectDevice(): Device {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad|Tablet/i.test(ua) || iPadOS || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

interface Session {
  id: string;
  /** Sessions never carry over to another student signing in on the same tab. */
  userId: string;
  lastActiveAt: number;
}

function readSession(userId: string): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const session = raw ? (JSON.parse(raw) as Session) : null;
    return session?.userId === userId ? session : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private mode / storage disabled — the in-memory session still works.
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

class ActivityTracker {
  private running = false;
  private userId = "";
  private slug: string | null = null;
  private device: Device = "desktop";
  private lastInputAt = 0;
  private lastArea: Activity | null = null;
  private lastTickAt = 0;
  private session: Session | null = null;
  private pending = new Map<string, Entry>();
  private inflight = false;
  private playing = new Set<HTMLMediaElement>();
  private timers: ReturnType<typeof setInterval>[] = [];

  start(userId: string): void {
    if (this.running || typeof window === "undefined") return;
    this.running = true;
    this.userId = userId;
    this.device = detectDevice();
    this.session = readSession(userId);
    const now = Date.now();
    this.lastTickAt = now;
    // Arriving on a page is itself an interaction.
    this.lastInputAt = now;
    for (const type of INPUT_EVENTS) window.addEventListener(type, this.onInput, { capture: true, passive: true });
    // Media events don't bubble, but capture at the document sees every
    // <audio>/<video> in the DOM.
    for (const type of ["play", "playing"]) document.addEventListener(type, this.onMediaPlay, true);
    for (const type of ["pause", "ended", "emptied"]) document.addEventListener(type, this.onMediaStop, true);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
    this.timers = [setInterval(this.tick, TICK_MS), setInterval(() => void this.flush(), FLUSH_MS)];
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const type of INPUT_EVENTS) window.removeEventListener(type, this.onInput, { capture: true });
    for (const type of ["play", "playing"]) document.removeEventListener(type, this.onMediaPlay, true);
    for (const type of ["pause", "ended", "emptied"]) document.removeEventListener(type, this.onMediaStop, true);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    this.timers.forEach(clearInterval);
    this.timers = [];
    void this.flush(true);
  }

  setShloka(slug: string | null): void {
    this.slug = slug;
  }

  count(counter: ActivityCounter, opts?: { typePct?: number }): void {
    if (!this.running) return;
    const entry = this.entryFor(Date.now());
    entry.counts[counter] += 1;
    if (opts?.typePct !== undefined) {
      entry.typeBestPct = Math.max(entry.typeBestPct ?? 0, Math.min(100, Math.max(0, opts.typePct)));
    }
  }

  /** Track an Audio object that isn't attached to the DOM (e.g. `new Audio(src)`). */
  watchMedia(el: HTMLMediaElement): void {
    el.addEventListener("play", () => this.playing.add(el));
    const stop = () => this.playing.delete(el);
    el.addEventListener("pause", stop);
    el.addEventListener("ended", stop);
  }

  private onInput = (e: Event): void => {
    this.lastInputAt = Date.now();
    if (!DISCRETE_INPUTS.has(e.type)) return;
    const area = e.target instanceof Element ? e.target.closest("[data-activity]")?.getAttribute("data-activity") : null;
    this.lastArea = area && PRACTICE_AREAS.has(area) ? (area as Activity) : null;
  };

  private onMediaPlay = (e: Event): void => {
    if (e.target instanceof HTMLMediaElement) this.playing.add(e.target);
  };

  private onMediaStop = (e: Event): void => {
    if (e.target instanceof HTMLMediaElement) this.playing.delete(e.target);
  };

  private onVisibility = (): void => {
    if (document.visibilityState === "hidden") void this.flush(true);
    else this.lastTickAt = Date.now();
  };

  private onPageHide = (): void => {
    void this.flush(true);
  };

  private isMediaPlaying(): boolean {
    for (const el of this.playing) {
      if (!el.paused && !el.ended) return true;
      this.playing.delete(el);
    }
    return false;
  }

  private tick = (): void => {
    const now = Date.now();
    const delta = Math.min(now - this.lastTickAt, MAX_TICK_MS);
    this.lastTickAt = now;
    if (document.visibilityState !== "visible") return;

    const listening = this.isMediaPlaying();
    const attentive = document.hasFocus() && now - this.lastInputAt < IDLE_AFTER_MS;
    if (!listening && !attentive) return;

    const activity: Activity =
      this.lastArea && now - this.lastInputAt < PRACTICE_FOCUS_MS
        ? this.lastArea
        : listening
          ? "listening"
          : this.slug
            ? "reading"
            : "browsing";
    this.entryFor(now).seconds[activity] += delta / 1000;

    if (!this.session || now - this.session.lastActiveAt > SESSION_GAP_MS) {
      this.session = { id: newSessionId(), userId: this.userId, lastActiveAt: now };
    } else {
      this.session.lastActiveAt = now;
    }
  };

  private entryFor(now: number): Entry {
    const d = new Date(now);
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hour = d.getHours();
    const key = `${day}|${hour}|${this.slug ?? ""}`;
    let entry = this.pending.get(key);
    if (!entry) {
      entry = {
        day,
        hour,
        slug: this.slug,
        seconds: Object.fromEntries(ACTIVITIES.map((a) => [a, 0])) as Entry["seconds"],
        counts: Object.fromEntries(COUNTERS.map((c) => [c, 0])) as Entry["counts"],
      };
      this.pending.set(key, entry);
    }
    return entry;
  }

  /** Put an unsent batch back, merging with anything recorded meanwhile. */
  private requeue(batch: [string, Entry][]): void {
    for (const [key, sent] of batch) {
      const cur = this.pending.get(key);
      if (!cur) {
        this.pending.set(key, sent);
        continue;
      }
      for (const a of ACTIVITIES) cur.seconds[a] += sent.seconds[a];
      for (const c of COUNTERS) cur.counts[c] += sent.counts[c];
      if (sent.typeBestPct !== undefined) cur.typeBestPct = Math.max(cur.typeBestPct ?? 0, sent.typeBestPct);
    }
    // Offline for a long time: keep the newest buckets only.
    while (this.pending.size > MAX_PENDING_ENTRIES) {
      this.pending.delete(this.pending.keys().next().value as string);
    }
  }

  async flush(keepalive = false): Promise<void> {
    if (this.pending.size === 0 || (this.inflight && !keepalive) || !this.session) return;
    const batch = [...this.pending].slice(0, MAX_ENTRIES_PER_FLUSH);
    for (const [key] of batch) this.pending.delete(key);
    writeSession(this.session);

    const entries = batch
      .map(([, e]) => ({
        day: e.day,
        hour: e.hour,
        slug: e.slug,
        seconds: Object.fromEntries(ACTIVITIES.filter((a) => e.seconds[a] >= 0.05).map((a) => [a, round1(e.seconds[a])])),
        counts: Object.fromEntries(COUNTERS.filter((c) => e.counts[c] > 0).map((c) => [c, e.counts[c]])),
        ...(e.typeBestPct ? { typeBestPct: round1(e.typeBestPct) } : {}),
      }))
      .filter((e) => Object.keys(e.seconds).length > 0 || Object.keys(e.counts).length > 0 || e.typeBestPct);
    if (entries.length === 0) return;

    this.inflight = true;
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        credentials: "include",
        keepalive,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.session.id, device: this.device, entries }),
      });
      // Server trouble → retry next flush. 4xx (signed out, rejected) → drop.
      if (res.status >= 500 || res.status === 429) this.requeue(batch);
    } catch {
      this.requeue(batch);
    } finally {
      this.inflight = false;
    }
  }
}

const tracker = new ActivityTracker();

export const startActivityTracking = (userId: string): void => tracker.start(userId);
export const stopActivityTracking = (): void => tracker.stop();
export const setActivityShloka = (slug: string | null): void => tracker.setShloka(slug);
export const watchMedia = (el: HTMLMediaElement): void => tracker.watchMedia(el);

/** Count a practice action for the current shloka. No-op unless a student is signed in. */
export const trackActivity = (counter: ActivityCounter, opts?: { typePct?: number }): void =>
  tracker.count(counter, opts);
