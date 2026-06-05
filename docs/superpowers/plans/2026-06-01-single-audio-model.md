# Single-Audio Shloka Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the shloka data model from dual-audio (per-line files + full file, each with their own word timings) down to a single full-audio file. New shlokas use a drag-into-bucket admin UI to group word regions into lines. Existing shlokas keep working via a legacy code path — no migration, no data loss.

**Architecture:** Backend fields become optional (`audio.lines`, `lines[].words`) so both old and new shapes validate. The frontend detects shape at runtime — if `audio.lines.length > 0`, use the existing player + admin UI unchanged; otherwise route to a new seek-based player + drag-into-bucket admin component. A thin `useShlokaPlayer` wrapper picks which underlying hook to run.

**Tech Stack:** Mongoose 8 + zod (backend), Next.js 15 + React 19 + Tailwind 4 + WaveSurfer.js + lucide-react (frontend). HTML5 drag-and-drop API (no new deps).

**Spec:** `docs/superpowers/specs/2026-06-01-single-audio-model-design.md`

---

## File Structure

**Backend (`shloka-backend/`):**
- Modify: `src/models/Shloka.ts` — `audio.lines` and `lines[].words` become optional
- Modify: `src/lib/publicShloka.ts` — mapper handles undefined `audio.lines`
- Modify: `src/routes/admin/shlokas.ts` — zod fields become optional
- Modify: `tests/adminShlokas.integration.test.ts` — 2 new test cases

**Frontend (`kayachikitsasutrani/`):**
- Modify: `src/lib/auth/types.ts` — `ShlokaLine.words` becomes optional
- Modify: `src/app/(student)/shloka/[slug]/ShlokaDesc.jsx` — globalWordIndex fallback
- Rename + adapt: `src/app/(student)/shloka/[slug]/hooks/useShlokaPlayer.ts` → keep file, but extract legacy logic into a new local hook + add wrapper
- Create: `src/app/(student)/shloka/[slug]/hooks/useLegacyShlokaPlayer.ts` (extracted from old hook)
- Create: `src/app/(student)/shloka/[slug]/hooks/useSeekShlokaPlayer.ts` (new seek-based)
- Create: `src/app/admin/shlokas/components/timing-editor/RegionBucketEditor.tsx`
- Create: `src/app/admin/shlokas/components/timing-editor/LineBucket.tsx`
- Create: `src/app/admin/shlokas/components/timing-editor/RegionCard.tsx`
- Create: `src/app/admin/shlokas/components/timing-editor/useRegionAssignment.ts`
- Modify: `src/app/admin/shlokas/components/ShlokaForm.tsx` — branch on legacy vs new shloka shape

---

## Task 1: Backend — make `audio.lines` and `lines[].words` optional

**Files:**
- Modify: `shloka-backend/src/models/Shloka.ts`
- Modify: `shloka-backend/src/lib/publicShloka.ts`
- Modify: `shloka-backend/src/routes/admin/shlokas.ts`

Working dir: `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend`

- [ ] **Step 1: Read current Shloka.ts**

```bash
cat src/models/Shloka.ts
```

Note current shapes of `audioSchema` and `lineSchema`.

- [ ] **Step 2: Modify `src/models/Shloka.ts`**

Change `audioSchema` so `lines` is optional (was `default: []` — keep that but ensure `required: false`). Actually the current code is `lines: { type: [assetSchema], default: [] }` which is already optional. Nothing to change here — confirm.

Change `lineSchema`:
- `words: { type: [wordTimingSchema], default: [] }` — already optional. No change.
- `fullTimings: { type: [wordTimingSchema], default: [] }` — keep as-is.

**Result:** No changes needed to `Shloka.ts` — the schema already allows empty `audio.lines` and empty `lines[].words`. The spec requirement (making them optional) is already satisfied.

- [ ] **Step 3: Modify `src/lib/publicShloka.ts`**

Currently:
```ts
audio: {
  full: mapAsset(doc.audio.full),
  lines: doc.audio.lines.map(mapAsset),
},
```

Change to defensively handle undefined:
```ts
audio: {
  full: mapAsset(doc.audio.full),
  lines: (doc.audio.lines ?? []).map(mapAsset),
},
```

- [ ] **Step 4: Modify `src/routes/admin/shlokas.ts`**

Find the `baseBodySchema` zod object. Current:
```ts
audio: z.object({
  full: assetSchema,
  lines: z.array(assetSchema),
}),
```

Change to:
```ts
audio: z.object({
  full: assetSchema,
  lines: z.array(assetSchema).optional().default([]),
}),
```

Find the `lineSchema` zod object. Current:
```ts
const lineSchema = z.object({
  sanskrit: z.string().min(1).max(1000),
  words: z.array(wordTimingSchema),
  fullTimings: z.array(wordTimingSchema),
});
```

Change to:
```ts
const lineSchema = z.object({
  sanskrit: z.string().min(1).max(1000),
  words: z.array(wordTimingSchema).optional().default([]),
  fullTimings: z.array(wordTimingSchema),
});
```

Find `validateTimings(body)` function — it iterates `audio.lines.length` and compares to `body.lines.length`. Change the check to allow empty `audio.lines`:

```ts
function validateTimings(body: z.infer<typeof baseBodySchema>): string | null {
  // If audio.lines is non-empty, it must align with body.lines (legacy path)
  if (body.audio.lines.length > 0 && body.audio.lines.length !== body.lines.length) {
    return 'audio.lines.length must equal lines.length';
  }
  for (let i = 0; i < body.lines.length; i++) {
    const line = body.lines[i];
    // words is now optional; only validate equality if both arrays are non-empty
    if (line.words.length > 0 && line.words.length !== line.fullTimings.length) {
      return `lines[${i}].words and fullTimings must have the same length`;
    }
    if (line.words.length > 0) {
      for (let k = 0; k < line.words.length; k++) {
        if (line.words[k].text !== line.fullTimings[k].text) {
          return `lines[${i}].words[${k}].text must equal lines[${i}].fullTimings[${k}].text`;
        }
      }
    }
    for (const arr of [line.words, line.fullTimings]) {
      for (let k = 0; k < arr.length; k++) {
        if (arr[k].start >= arr[k].end) return `lines[${i}] timing ${k}: start must be < end`;
        if (k > 0 && arr[k].start < arr[k - 1].end) return `lines[${i}] timing ${k}: overlaps previous`;
      }
    }
  }
  return null;
}
```

- [ ] **Step 5: tsc + run tests + commit + push**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend
npx tsc --noEmit
npm test 2>&1 | tail -10
```

Expected: tsc clean. All tests pass (~103).

```bash
git add src/lib/publicShloka.ts src/routes/admin/shlokas.ts
git commit -m "feat: make audio.lines + lines[].words optional for single-audio shloka model"
git push origin main
```

---

## Task 2: Backend — 2 new integration tests for single-audio model

**Files:**
- Modify: `shloka-backend/tests/adminShlokas.integration.test.ts`

- [ ] **Step 1: Add 2 new test cases**

Read the existing file to see the `VALID_BODY` fixture + test structure. Add these tests inside the same describe block (just before the closing `});`):

```ts
it('accepts a single-audio shloka (no audio.lines, empty lines[].words)', async () => {
  const body = {
    slug: 'single-audio-shloka',
    title: 'Single Audio Shloka',
    meaning: 'A test shloka using only the full audio.',
    fullText: 'om gam ganapataye namah',
    status: 'draft' as const,
    audio: {
      full: { url: 'https://res.cloudinary.com/x/a.mp3', publicId: 'a' },
      // no `lines` field — optional now
    },
    lines: [{
      sanskrit: 'om gam ganapataye namah',
      // no `words` field — optional now
      fullTimings: [
        { text: 'om', start: 0, end: 0.5 },
        { text: 'gam', start: 0.5, end: 1.0 },
        { text: 'ganapataye', start: 1.0, end: 2.0 },
        { text: 'namah', start: 2.0, end: 2.5 },
      ],
    }],
  };
  const res = await request(app)
    .post('/api/admin/shlokas')
    .set('Cookie', adminCookie)
    .send(body);
  expect(res.status).toBe(201);
  expect(res.body.slug).toBe('single-audio-shloka');
  expect(res.body.audio.lines).toEqual([]);
  expect(res.body.lines[0].fullTimings).toHaveLength(4);
  expect(res.body.lines[0].words).toEqual([]);
});

it('GET /api/shlokas/:slug returns empty audio.lines for single-audio shlokas', async () => {
  // Use the slug from the previous test (or seed one in beforeEach if independent)
  // Here we seed inline:
  const u = await User.create({ email: 'a@x.test', passwordHash: 'x', role: 'admin', name: 'A' });
  await Shloka.create({
    slug: 'single-audio-readonly',
    title: 'Single Audio Read',
    meaning: 'm',
    fullText: 'a b',
    status: 'published',
    audio: { full: { url: 'u', publicId: 'p' } },
    lines: [{
      sanskrit: 'a b',
      fullTimings: [
        { text: 'a', start: 0, end: 1 },
        { text: 'b', start: 1, end: 2 },
      ],
    }],
    createdBy: u._id,
  });
  const res = await request(app).get('/api/shlokas/single-audio-readonly');
  expect(res.status).toBe(200);
  expect(res.body.audio.lines).toEqual([]);
  expect(res.body.lines[0].words).toEqual([]);
  expect(res.body.lines[0].fullTimings).toHaveLength(2);
});
```

If the test file uses `VALID_BODY` (a top-level const) — leave that legacy fixture intact for the existing tests. Just add the new test cases.

If `adminCookie` isn't defined as a shared variable, look at how existing tests authenticate (probably a helper `cookieFor(userId)`). Use the same pattern.

- [ ] **Step 2: Run tests + commit + push**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend
npm test -- adminShlokas 2>&1 | tail -10
npm test 2>&1 | tail -5
```

Expected: 2 new tests pass. Full suite passes (~105 now).

```bash
git add tests/adminShlokas.integration.test.ts
git commit -m "test: integration tests for single-audio shloka POST + GET"
git push origin main
```

---

## Task 3: Frontend types — make `ShlokaLine.words` optional

**Files:**
- Modify: `kayachikitsasutrani/src/lib/auth/types.ts`

Working dir: `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani`

- [ ] **Step 1: Modify `ShlokaLine` interface**

Find:
```ts
export interface ShlokaLine {
  sanskrit: string;
  words: WordTiming[];
  fullTimings: WordTiming[];
}
```

Change to:
```ts
export interface ShlokaLine {
  sanskrit: string;
  words?: WordTiming[];
  fullTimings: WordTiming[];
}
```

- [ ] **Step 2: tsc check + commit**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
npx tsc --noEmit 2>&1 | tail -15
```

Expected: errors will surface in files that access `line.words` directly (e.g., `ShlokaForm.tsx`, `useShlokaPlayer.ts`, `ShlokaDisplay.jsx` if any references remain, `useTimingState.ts`). DON'T fix those here — that's later tasks. Verify ONLY the type definition changed.

```bash
git add src/lib/auth/types.ts
git commit -m "feat(types): ShlokaLine.words becomes optional for single-audio model"
```

(Don't push yet — frontend changes batch together at the end.)

---

## Task 4: ShlokaDesc — globalWordIndex fallback

**Files:**
- Modify: `kayachikitsasutrani/src/app/(student)/shloka/[slug]/ShlokaDesc.jsx`

- [ ] **Step 1: Modify the globalWordIndex computation**

Find:
```jsx
const globalWordIndex = (() => {
  if (player.state.status === "IDLE" || player.state.status === "DONE") return -1;
  let g = 0;
  for (let i = 0; i < player.currentLine; i++) {
    g += shloka.lines[i]?.words?.length ?? 0;
  }
  return g + player.currentWordIndex;
})();
```

Change the inner sum to fall back to `fullTimings.length` when `words` is undefined or empty:

```jsx
const globalWordIndex = (() => {
  if (player.state.status === "IDLE" || player.state.status === "DONE") return -1;
  let g = 0;
  for (let i = 0; i < player.currentLine; i++) {
    const line = shloka.lines[i];
    const count = (line?.words?.length || 0) || (line?.fullTimings?.length || 0);
    g += count;
  }
  return g + player.currentWordIndex;
})();
```

The change: when a shloka uses the new model (`words` undefined / empty), use `fullTimings.length` instead.

- [ ] **Step 2: Commit**

```bash
git add "src/app/(student)/shloka/[slug]/ShlokaDesc.jsx"
git commit -m "fix(ShlokaDesc): fall back to fullTimings count when words is empty"
```

---

## Task 5: Rename current `useShlokaPlayer` internals into `useLegacyShlokaPlayer`

**Files:**
- Create: `src/app/(student)/shloka/[slug]/hooks/useLegacyShlokaPlayer.ts` (copy of current `useShlokaPlayer.ts`)
- Modify (later in Task 7): `useShlokaPlayer.ts` becomes a thin wrapper

- [ ] **Step 1: Copy file**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
cp "src/app/(student)/shloka/[slug]/hooks/useShlokaPlayer.ts" "src/app/(student)/shloka/[slug]/hooks/useLegacyShlokaPlayer.ts"
```

- [ ] **Step 2: Rename the export inside the new file**

Open `src/app/(student)/shloka/[slug]/hooks/useLegacyShlokaPlayer.ts` and find:

```ts
export function useShlokaPlayer(shloka: PublicShloka): UseShlokaPlayerReturn {
```

Change to:

```ts
export function useLegacyShlokaPlayer(shloka: PublicShloka): UseShlokaPlayerReturn {
```

If `UseShlokaPlayerReturn` is exported from this file, keep it exported (it'll be re-used by the new hooks). Same for any types like `PlayerState`.

- [ ] **Step 3: tsc check**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

There will be errors saying `useShlokaPlayer` isn't exported from this file anymore. The old `useShlokaPlayer.ts` file still has the old export and is what's actually imported by ShlokaDesc. tsc should be clean.

If there are errors, paste them.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(student)/shloka/[slug]/hooks/useLegacyShlokaPlayer.ts"
git commit -m "refactor(player): duplicate useShlokaPlayer into useLegacyShlokaPlayer (no behavior change)"
```

---

## Task 6: Create `useSeekShlokaPlayer` for the single-audio model

**Files:**
- Create: `src/app/(student)/shloka/[slug]/hooks/useSeekShlokaPlayer.ts`

This hook handles shlokas that have NO `audio.lines` — playback uses seek-based control on the single full audio file.

- [ ] **Step 1: Write the hook**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicShloka } from "@/lib/auth/types";

const REPETITIONS = 3;
const PAUSE_MS = 500;

type Mode = "LINE" | "FULL";

interface SeekState {
  status: "IDLE" | "PLAYING_LINE" | "PLAYING_FULL" | "PAUSED" | "DONE";
  mode: Mode;
  line: number;       // current line index
  rep: number;        // current rep (1..REPETITIONS)
  // For PAUSED, remember what to resume to:
  resumeMode?: Mode;
  resumeLine?: number;
  resumeRep?: number;
}

const INITIAL: SeekState = { status: "IDLE", mode: "LINE", line: 0, rep: 0 };

export interface UseShlokaPlayerReturn {
  state: { status: SeekState["status"]; rep?: number; mode?: Mode; prev?: { status: string; mode?: Mode } };
  currentLine: number;
  currentWordIndex: number;
  rep: number;
  REPETITIONS: number;
  audioRef: React.RefObject<HTMLAudioElement>;
  currentSrc: string | null;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  resume: () => void;
  skipPrev: () => void;
  skipNext: () => void;
}

export function useSeekShlokaPlayer(shloka: PublicShloka): UseShlokaPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [s, setS] = useState<SeekState>(INITIAL);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  const fullUrl = shloka.audio.full?.url ?? null;
  const totalLines = shloka.lines?.length ?? 0;

  // Helper: get [start, end] for line K's playback window using fullTimings.
  const lineWindow = useCallback((k: number): [number, number] | null => {
    const t = shloka.lines?.[k]?.fullTimings ?? [];
    if (t.length === 0) return null;
    return [t[0].start, t[t.length - 1].end];
  }, [shloka]);

  // ──────────── Drive playback when state changes ────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (s.status === "PLAYING_LINE") {
      const win = lineWindow(s.line);
      if (!win) {
        // No timings on this line → advance immediately
        setS((prev) => ({ ...prev, status: "PLAYING_LINE", line: prev.line + 1, rep: 1 }));
        return;
      }
      // Seek + play if we're not already inside the window
      if (audio.currentTime < win[0] || audio.currentTime >= win[1]) {
        try { audio.currentTime = win[0]; } catch { /* ignore */ }
      }
      void audio.play().catch(() => { /* user-gesture issues */ });
    } else if (s.status === "PLAYING_FULL") {
      // Set to 0 only at rep boundaries
      if (audio.currentTime >= audio.duration - 0.05 || audio.currentTime === 0) {
        try { audio.currentTime = 0; } catch { /* ignore */ }
      }
      void audio.play().catch(() => { /* */ });
    } else if (s.status === "PAUSED" || s.status === "IDLE" || s.status === "DONE") {
      audio.pause();
    }
  }, [s.status, s.line, s.rep, lineWindow]);

  // ──────────── timeupdate: end-of-window detection + word index ────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const t = audio.currentTime;
      // Update currentWordIndex within the current line
      if (s.status === "PLAYING_LINE" || (s.status === "PAUSED" && s.resumeMode === "LINE")) {
        const arr = shloka.lines?.[s.line]?.fullTimings ?? [];
        const idx = arr.findIndex((w) => t >= w.start && t < w.end);
        setCurrentWordIndex(idx);
      } else if (s.status === "PLAYING_FULL" || (s.status === "PAUSED" && s.resumeMode === "FULL")) {
        // Find which line + which word
        let foundLine = -1, foundIdx = -1;
        for (let i = 0; i < (shloka.lines?.length ?? 0); i++) {
          const arr = shloka.lines[i].fullTimings ?? [];
          const k = arr.findIndex((w) => t >= w.start && t < w.end);
          if (k >= 0) { foundLine = i; foundIdx = k; break; }
        }
        if (foundLine >= 0) {
          setCurrentWordIndex(foundIdx);
          if (s.line !== foundLine) {
            // Don't mutate state during playback for full mode line tracking — only update word index
          }
        } else {
          setCurrentWordIndex(-1);
        }
      } else {
        setCurrentWordIndex(-1);
      }

      // End-of-window detection
      if (s.status === "PLAYING_LINE") {
        const win = lineWindow(s.line);
        if (win && t >= win[1] - 0.02) {
          audio.pause();
          // Decide next state: rep++, line++, or full
          if (s.rep < REPETITIONS) {
            // Repeat the same line
            setTimeout(() => {
              setS({ ...s, rep: s.rep + 1 });
            }, PAUSE_MS);
          } else if (s.line + 1 < totalLines) {
            setTimeout(() => {
              setS({ status: "PLAYING_LINE", mode: "LINE", line: s.line + 1, rep: 1 });
            }, PAUSE_MS);
          } else {
            // Lines done — start full reps
            setTimeout(() => {
              setS({ status: "PLAYING_FULL", mode: "FULL", line: 0, rep: 1 });
            }, PAUSE_MS);
          }
        }
      }
    };

    const onEnded = () => {
      if (s.status === "PLAYING_FULL") {
        if (s.rep < REPETITIONS) {
          setTimeout(() => {
            setS({ status: "PLAYING_FULL", mode: "FULL", line: 0, rep: s.rep + 1 });
          }, PAUSE_MS);
        } else {
          setS({ ...INITIAL, status: "DONE" });
          setCurrentWordIndex(-1);
        }
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [s, shloka, lineWindow, totalLines]);

  const play = useCallback(() => {
    if (s.status === "IDLE" || s.status === "DONE") {
      setS({ status: "PLAYING_LINE", mode: "LINE", line: 0, rep: 1 });
    }
  }, [s.status]);

  const pause = useCallback(() => {
    setS((prev) => ({
      ...prev,
      status: "PAUSED",
      resumeMode: prev.mode,
      resumeLine: prev.line,
      resumeRep: prev.rep,
    }));
  }, []);

  const resume = useCallback(() => {
    setS((prev) => {
      if (prev.status !== "PAUSED") return prev;
      return {
        ...prev,
        status: prev.resumeMode === "FULL" ? "PLAYING_FULL" : "PLAYING_LINE",
        line: prev.resumeLine ?? 0,
        rep: prev.resumeRep ?? 1,
      };
    });
  }, []);

  const skipPrev = useCallback(() => {
    setS((prev) => {
      const newLine = Math.max(0, prev.line - 1);
      return { status: "PLAYING_LINE", mode: "LINE", line: newLine, rep: 1 };
    });
  }, []);

  const skipNext = useCallback(() => {
    setS((prev) => {
      const newLine = prev.line + 1;
      if (newLine >= totalLines) {
        return { status: "PLAYING_FULL", mode: "FULL", line: 0, rep: 1 };
      }
      return { status: "PLAYING_LINE", mode: "LINE", line: newLine, rep: 1 };
    });
  }, [totalLines]);

  const isPlaying = s.status === "PLAYING_LINE" || s.status === "PLAYING_FULL";

  return {
    state: {
      status: s.status,
      rep: s.rep,
      mode: s.mode,
      prev: { status: s.status, mode: s.resumeMode },
    },
    currentLine: s.line,
    currentWordIndex,
    rep: s.rep,
    REPETITIONS,
    audioRef: audioRef as React.RefObject<HTMLAudioElement>,
    currentSrc: fullUrl,
    isPlaying,
    play,
    pause,
    resume,
    skipPrev,
    skipNext,
  };
}
```

This hook intentionally mirrors the surface of the legacy `useShlokaPlayer` so the wrapper (Task 7) can return either. The state machine is simpler: line K plays rep 1..3, advances to line K+1, after last line plays full rep 1..3, done.

- [ ] **Step 2: tsc check + commit**

```bash
npx tsc --noEmit 2>&1 | tail -10
git add "src/app/(student)/shloka/[slug]/hooks/useSeekShlokaPlayer.ts"
git commit -m "feat(player): useSeekShlokaPlayer for single-audio model"
```

---

## Task 7: Wrap useShlokaPlayer to pick the right hook by shloka shape

**Files:**
- Modify: `src/app/(student)/shloka/[slug]/hooks/useShlokaPlayer.ts`

This file currently CONTAINS the full legacy implementation. We replace its body with a thin wrapper.

- [ ] **Step 1: Replace file contents**

```ts
"use client";

import type { PublicShloka } from "@/lib/auth/types";
import { useLegacyShlokaPlayer } from "./useLegacyShlokaPlayer";
import { useSeekShlokaPlayer, type UseShlokaPlayerReturn } from "./useSeekShlokaPlayer";

/**
 * Picks the right player based on shloka shape:
 * - Legacy (per-line audio files): use `useLegacyShlokaPlayer`
 * - New (single full-audio only): use `useSeekShlokaPlayer`
 *
 * Both hooks are called (React rules), but only the active branch drives the
 * `<audio>` element. The inactive hook's state stays in IDLE indefinitely.
 */
export function useShlokaPlayer(shloka: PublicShloka): UseShlokaPlayerReturn {
  const isLegacy = (shloka.audio.lines?.length ?? 0) > 0;
  const legacy = useLegacyShlokaPlayer(shloka);
  const seek = useSeekShlokaPlayer(shloka);
  return isLegacy ? legacy : seek;
}

export type { UseShlokaPlayerReturn };
```

Both hooks return `UseShlokaPlayerReturn`. Since they share the type, the conditional return is type-safe.

The inactive hook also instantiates its own `audioRef`. Since only the active branch's ref is returned, the inactive one is never bound to the `<audio>` element in ShlokaDesc — its useEffects fire but find `audioRef.current === null` and exit.

- [ ] **Step 2: Verify legacy hook exports `UseShlokaPlayerReturn`**

If the legacy hook (now `useLegacyShlokaPlayer.ts`) doesn't `export` the `UseShlokaPlayerReturn` type, it must — otherwise the new wrapper won't type-check. Open the file and ensure:

```ts
export interface UseShlokaPlayerReturn { ... }
```

If it was declared but not exported, add `export`.

- [ ] **Step 3: tsc check + commit**

```bash
npx tsc --noEmit 2>&1 | tail -15
git add "src/app/(student)/shloka/[slug]/hooks/useShlokaPlayer.ts" "src/app/(student)/shloka/[slug]/hooks/useLegacyShlokaPlayer.ts"
git commit -m "refactor(player): useShlokaPlayer becomes a thin wrapper over legacy/seek hooks"
```

---

## Task 8: `useRegionAssignment` hook — manages region → bucket map

**Files:**
- Create: `src/app/admin/shlokas/components/timing-editor/useRegionAssignment.ts`

- [ ] **Step 1: Write the hook**

```ts
"use client";

import { useCallback, useState } from "react";

export interface Region {
  id: string;
  start: number;
  end: number;
  text?: string;   // auto-derived from line.sanskrit split by space, or empty
}

interface State {
  /** All regions marked on the waveform, keyed by id. */
  regions: Record<string, Region>;
  /** assignment[regionId] === lineIndex (>=0) OR undefined (unassigned). */
  assignment: Record<string, number>;
}

export interface UseRegionAssignment {
  regions: Region[];
  unassigned: Region[];
  byLine: (lineIndex: number) => Region[];
  addRegion: (r: Omit<Region, "id">) => string;
  updateRegion: (id: string, r: Partial<Omit<Region, "id">>) => void;
  removeRegion: (id: string) => void;
  assign: (regionId: string, lineIndex: number) => void;
  unassign: (regionId: string) => void;
  /** Build the lines[] shape expected by ShlokaInput. */
  buildLines: (lineSanskritList: string[]) => Array<{
    sanskrit: string;
    fullTimings: Array<{ text: string; start: number; end: number }>;
  }>;
}

let nextId = 0;

export function useRegionAssignment(initialRegions: Region[] = [], initialAssignment: Record<string, number> = {}): UseRegionAssignment {
  const [state, setState] = useState<State>(() => ({
    regions: Object.fromEntries(initialRegions.map((r) => [r.id, r])),
    assignment: { ...initialAssignment },
  }));

  const addRegion = useCallback((r: Omit<Region, "id">) => {
    const id = `r${++nextId}_${Date.now()}`;
    setState((s) => ({
      regions: { ...s.regions, [id]: { ...r, id } },
      assignment: s.assignment,
    }));
    return id;
  }, []);

  const updateRegion = useCallback((id: string, patch: Partial<Omit<Region, "id">>) => {
    setState((s) => {
      if (!s.regions[id]) return s;
      return {
        regions: { ...s.regions, [id]: { ...s.regions[id], ...patch } },
        assignment: s.assignment,
      };
    });
  }, []);

  const removeRegion = useCallback((id: string) => {
    setState((s) => {
      const { [id]: _, ...regions } = s.regions;
      const { [id]: __, ...assignment } = s.assignment;
      return { regions, assignment };
    });
  }, []);

  const assign = useCallback((regionId: string, lineIndex: number) => {
    setState((s) => ({
      regions: s.regions,
      assignment: { ...s.assignment, [regionId]: lineIndex },
    }));
  }, []);

  const unassign = useCallback((regionId: string) => {
    setState((s) => {
      const { [regionId]: _, ...rest } = s.assignment;
      return { regions: s.regions, assignment: rest };
    });
  }, []);

  const regions = Object.values(state.regions).sort((a, b) => a.start - b.start);
  const unassigned = regions.filter((r) => state.assignment[r.id] === undefined);
  const byLine = useCallback(
    (lineIndex: number): Region[] =>
      regions.filter((r) => state.assignment[r.id] === lineIndex),
    [regions, state.assignment],
  );

  const buildLines = useCallback((lineSanskritList: string[]) => {
    return lineSanskritList.map((sanskrit, lineIndex) => {
      const sanskritWords = sanskrit.split(/\s+/).filter(Boolean);
      const regs = regions.filter((r) => state.assignment[r.id] === lineIndex);
      return {
        sanskrit,
        fullTimings: regs.map((r, k) => ({
          text: sanskritWords[k] ?? r.text ?? "",
          start: r.start,
          end: r.end,
        })),
      };
    });
  }, [regions, state.assignment]);

  return {
    regions,
    unassigned,
    byLine,
    addRegion,
    updateRegion,
    removeRegion,
    assign,
    unassign,
    buildLines,
  };
}
```

- [ ] **Step 2: tsc check + commit**

```bash
npx tsc --noEmit 2>&1 | tail -5
git add src/app/admin/shlokas/components/timing-editor/useRegionAssignment.ts
git commit -m "feat(admin): useRegionAssignment hook for managing region->line buckets"
```

---

## Task 9: `RegionCard` + `LineBucket` components

**Files:**
- Create: `src/app/admin/shlokas/components/timing-editor/RegionCard.tsx`
- Create: `src/app/admin/shlokas/components/timing-editor/LineBucket.tsx`

- [ ] **Step 1: Write `RegionCard.tsx`**

```tsx
"use client";

import React from "react";
import { X } from "lucide-react";
import type { Region } from "./useRegionAssignment";

interface Props {
  region: Region;
  onRemove?: () => void;
  /** Drag handler — sets dataTransfer payload to region id. */
  onDragStart: (e: React.DragEvent) => void;
}

const RegionCard: React.FC<Props> = ({ region, onRemove, onDragStart }) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="inline-flex items-center gap-2 bg-white border border-[#E5DDD0] rounded-lg px-2 py-1 text-xs cursor-grab active:cursor-grabbing shrink-0"
    >
      <span className="font-mono text-gray-500">
        {region.start.toFixed(2)}–{region.end.toFixed(2)}s
      </span>
      {region.text && <span className="text-brown font-medium truncate max-w-[100px]">{region.text}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-red-500 hover:text-red-700"
          aria-label="Remove region"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

export default RegionCard;
```

- [ ] **Step 2: Write `LineBucket.tsx`**

```tsx
"use client";

import React, { useState } from "react";
import RegionCard from "./RegionCard";
import type { Region } from "./useRegionAssignment";

interface Props {
  lineIndex: number;
  sanskrit: string;
  regions: Region[];
  onSanskritChange: (next: string) => void;
  onDropRegion: (regionId: string) => void;
  onUnassignRegion: (regionId: string) => void;
  onRemoveRegion: (regionId: string) => void;
}

const LineBucket: React.FC<Props> = ({
  lineIndex, sanskrit, regions, onSanskritChange, onDropRegion, onUnassignRegion, onRemoveRegion,
}) => {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropRegion(id);
      }}
      className={`border-2 border-dashed rounded-lg p-3 transition ${
        over ? "border-accent bg-accent-soft" : "border-[#E5DDD0] bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-brown shrink-0">Line {lineIndex + 1}</span>
        <input
          type="text"
          value={sanskrit}
          onChange={(e) => onSanskritChange(e.target.value)}
          placeholder="Sanskrit text for this line"
          className="flex-1 text-sm border border-[#E5DDD0] rounded px-2 py-1 outline-none focus:border-accent"
        />
        <span className="text-[10px] text-gray-500 shrink-0">
          {regions.length} word{regions.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {regions.length === 0 ? (
          <span className="text-[10px] text-gray-400 italic">Drop region cards here</span>
        ) : (
          regions.map((r) => (
            <RegionCard
              key={r.id}
              region={r}
              onRemove={() => onRemoveRegion(r.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", r.id);
                // Also unassign so the drop target adds it (otherwise it might end up in two)
                // We'll handle re-assignment in the new bucket's onDrop. For now, just send id.
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default LineBucket;
```

- [ ] **Step 3: tsc check + commit**

```bash
npx tsc --noEmit 2>&1 | tail -5
git add src/app/admin/shlokas/components/timing-editor/RegionCard.tsx src/app/admin/shlokas/components/timing-editor/LineBucket.tsx
git commit -m "feat(admin): RegionCard + LineBucket components for drag-into-line UI"
```

---

## Task 10: `RegionBucketEditor` composite

**Files:**
- Create: `src/app/admin/shlokas/components/timing-editor/RegionBucketEditor.tsx`

- [ ] **Step 1: Write the composite**

```tsx
"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";
import Waveform from "./Waveform";
import LineBucket from "./LineBucket";
import RegionCard from "./RegionCard";
import { useRegionAssignment, type Region } from "./useRegionAssignment";

interface LineSeed {
  sanskrit: string;
  /** Pre-existing regions to render on the waveform on mount. */
  fullTimings?: Array<{ text?: string; start: number; end: number }>;
}

interface Props {
  fullAudioUrl?: string;
  /** Initial lines (sanskrit + their fullTimings); if empty, start with 1 blank line. */
  initialLines?: LineSeed[];
  /** Called whenever the structure changes — parent builds the body from this. */
  onChange: (lines: Array<{
    sanskrit: string;
    fullTimings: Array<{ text: string; start: number; end: number }>;
  }>) => void;
}

const RegionBucketEditor: React.FC<Props> = ({ fullAudioUrl, initialLines = [{ sanskrit: "" }], onChange }) => {
  const [lineSanskrit, setLineSanskrit] = useState<string[]>(initialLines.map((l) => l.sanskrit ?? ""));

  // Pre-seed regions + assignments from initialLines
  const seededRegions: Region[] = [];
  const seededAssignment: Record<string, number> = {};
  let seedCounter = 0;
  initialLines.forEach((l, idx) => {
    (l.fullTimings ?? []).forEach((t) => {
      const id = `seed${seedCounter++}`;
      seededRegions.push({ id, start: t.start, end: t.end, text: t.text });
      seededAssignment[id] = idx;
    });
  });

  const ra = useRegionAssignment(seededRegions, seededAssignment);

  // Sync parent on every state change
  React.useEffect(() => {
    onChange(ra.buildLines(lineSanskrit));
  }, [ra.regions, ra.unassigned, lineSanskrit, ra.buildLines]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSanskritAt = (i: number, next: string) => {
    setLineSanskrit((prev) => prev.map((s, k) => (k === i ? next : s)));
  };

  const addLine = () => setLineSanskrit((prev) => [...prev, ""]);
  const removeLastLine = () => {
    if (lineSanskrit.length <= 1) return;
    const lastIdx = lineSanskrit.length - 1;
    // Unassign all regions in the last bucket
    ra.byLine(lastIdx).forEach((r) => ra.unassign(r.id));
    setLineSanskrit((prev) => prev.slice(0, -1));
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-brown">Full-audio word regions</div>

      {fullAudioUrl ? (
        <Waveform
          audioUrl={fullAudioUrl}
          regions={ra.regions.map((r) => ({ id: r.id, start: r.start, end: r.end }))}
          onRegionCreate={(start, end) => {
            return ra.addRegion({ start, end });
          }}
          onRegionUpdate={(id, start, end) => ra.updateRegion(id, { start, end })}
          onError={() => {}}
        />
      ) : (
        <div className="border border-dashed border-[#E5DDD0] rounded p-6 text-center text-xs text-gray-500">
          Upload the full audio first to start marking word regions.
        </div>
      )}

      {/* Unassigned pool */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="text-xs font-bold text-brown mb-2">
          Unassigned ({ra.unassigned.length})
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {ra.unassigned.length === 0 ? (
            <span className="text-[10px] text-gray-500 italic">All regions assigned ✓</span>
          ) : (
            ra.unassigned.map((r) => (
              <RegionCard
                key={r.id}
                region={r}
                onRemove={() => ra.removeRegion(r.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", r.id);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Line buckets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-brown">Lines ({lineSanskrit.length})</div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={removeLastLine}
              disabled={lineSanskrit.length <= 1}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#E5DDD0] text-brown disabled:opacity-40"
            >
              <Minus size={12} /> Remove
            </button>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-accent text-white"
            >
              <Plus size={12} /> Add line
            </button>
          </div>
        </div>
        {lineSanskrit.map((sanskrit, i) => (
          <LineBucket
            key={i}
            lineIndex={i}
            sanskrit={sanskrit}
            regions={ra.byLine(i)}
            onSanskritChange={(next) => setSanskritAt(i, next)}
            onDropRegion={(regionId) => ra.assign(regionId, i)}
            onUnassignRegion={(regionId) => ra.unassign(regionId)}
            onRemoveRegion={(regionId) => ra.removeRegion(regionId)}
          />
        ))}
      </div>
    </div>
  );
};

export default RegionBucketEditor;
```

- [ ] **Step 2: tsc check + commit**

```bash
npx tsc --noEmit 2>&1 | tail -10
git add src/app/admin/shlokas/components/timing-editor/RegionBucketEditor.tsx
git commit -m "feat(admin): RegionBucketEditor composite for single-audio shloka editing"
```

---

## Task 11: ShlokaForm — branch UI based on shloka shape

**Files:**
- Modify: `src/app/admin/shlokas/components/ShlokaForm.tsx`

- [ ] **Step 1: Determine model + add state**

Near the top of the component, add:

```tsx
const isLegacy = (initial?.audio.lines?.length ?? 0) > 0;
// New model: a parallel state shape capturing fullTimings per line
const [newModelLines, setNewModelLines] = useState<Array<{
  sanskrit: string;
  fullTimings: Array<{ text: string; start: number; end: number }>;
}>>(
  isLegacy || !initial
    ? []  // legacy or brand-new: not used yet
    : initial.lines.map((l) => ({
        sanskrit: l.sanskrit,
        fullTimings: l.fullTimings ?? [],
      }))
);
```

- [ ] **Step 2: In the JSX, branch between legacy editor and new editor**

Find where the existing `<TimingEditor />` (or per-line stack) is rendered. Wrap it in:

```tsx
{isLegacy ? (
  <>
    {/* existing per-line audio upload + per-line TimingEditor stack — unchanged */}
    {/* leave the existing JSX block here */}
  </>
) : (
  <RegionBucketEditor
    fullAudioUrl={audioFull?.url}
    initialLines={
      initial?.lines.map((l) => ({
        sanskrit: l.sanskrit,
        fullTimings: l.fullTimings ?? [],
      })) ?? [{ sanskrit: "" }]
    }
    onChange={(lines) => setNewModelLines(lines)}
  />
)}
```

Import at the top:

```tsx
import RegionBucketEditor from "./timing-editor/RegionBucketEditor";
```

- [ ] **Step 3: In `submit()`, build body from the right state**

In the `submit()` function where the body is built, branch:

```tsx
const builtLines = isLegacy
  ? lines.map(/* existing legacy code that uses TimingEditor state */)
  : newModelLines;

const body: ShlokaInput = {
  slug,
  title,
  meaning,
  fullText: fullText.trim() || undefined,
  caseStudy: caseStudy.trim() || undefined,
  status: nextStatus,
  audio: {
    full: audioFull ?? { url: "", publicId: "" },
    lines: isLegacy
      ? lines.map((l) => l.audio ?? { url: "", publicId: "" })
      : [],  // new model: empty array
  },
  image,
  lines: builtLines,
};
```

If `isLegacy === false`, validate that all regions are assigned before submitting:

```tsx
if (!isLegacy && nextStatus === "published") {
  const totalRegions = newModelLines.reduce((sum, l) => sum + l.fullTimings.length, 0);
  // If parent's RegionBucketEditor still has unassigned regions, they won't appear in newModelLines.
  // Instead, surface the count via a callback OR a ref. For simplicity, check via a separate state.
  // Skip this validation if too complex — backend will reject if timings don't match.
}
```

(Skip the validation if it complicates this task — the backend will catch issues; UX improvement is deferred.)

- [ ] **Step 4: tsc + build smoke + commit**

```bash
npx tsc --noEmit 2>&1 | tail -10
npm run build 2>&1 | tail -10
git add src/app/admin/shlokas/components/ShlokaForm.tsx
git commit -m "feat(admin): ShlokaForm branches between legacy and single-audio editors"
```

---

## Task 12: Final tsc + lint + build verification

**Files:** none

- [ ] **Step 1: Run all checks**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
echo "=== TSC ==="
npx tsc --noEmit 2>&1 | tail -20
echo "=== LINT ==="
npm run lint 2>&1 | tail -15
echo "=== BUILD ==="
npm run build 2>&1 | tail -20
```

Expected: all clean (or only pre-existing warnings).

- [ ] **Step 2: Fix any issues inline**

Likely candidates:
- Old `useShlokaPlayer.ts` still imports from `./playerReducer` — confirm those imports are now in `useLegacyShlokaPlayer.ts` instead
- Unused imports left over from the rename — remove them
- Type mismatch where `ShlokaLine.words` is accessed without `?.` chaining — add the chain

For each error, paste it; the fix is usually a 1-line edit.

- [ ] **Step 3: Commit fix-ups (idempotent)**

```bash
git add -A
git commit -m "fix(single-audio): final tsc/lint cleanup" --allow-empty
```

---

## Task 13: Push + manual QA

**Files:** none

- [ ] **Step 1: Push frontend**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
git push origin main
```

Backend was already pushed in Tasks 1 + 2.

- [ ] **Step 2: Wait ~2 minutes for Vercel + Render redeploys**

- [ ] **Step 3: Manual QA matrix**

| # | Action | Expected |
|---|---|---|
| 1 | Open admin → /admin/shlokas/new | "Full audio" upload + RegionBucketEditor (no per-line audio uploads) |
| 2 | Upload full audio | Waveform renders. Marked regions go to Unassigned pool. |
| 3 | Drag region from pool into "Line 1" bucket | Region card moves into Line 1 bucket. Pool count decreases. |
| 4 | Drag region from Line 1 to Line 2 | Region moves between buckets. |
| 5 | Add another line (+ Add line) | New empty bucket appears. |
| 6 | Type sanskrit text in Line 1 + Line 2 inputs | Updates in state. |
| 7 | Save as Draft | Backend accepts (no `audio.lines`, no per-line `words`). Page stays on edit (per existing draft-save behavior). |
| 8 | Set published, save | Saves successfully. Returns to shloka list. |
| 9 | Open the new shloka on /shloka/[slug] | Plays via seek-based hook. Word highlight walks through fullText. |
| 10 | Open a legacy shloka in admin | Old per-line audio + TimingEditor UI renders (unchanged). |
| 11 | Play legacy shloka on /shloka/[slug] | Existing src-swap playback works (unchanged). |
| 12 | Speed control on both new + legacy | Both apply `playbackRate` correctly. |
| 13 | Skip-prev / Skip-next on new model | Advances line correctly. |
| 14 | Pause / Resume on new model | Resumes from same audio position. |

- [ ] **Step 4: Report any breaks**

---

## Verification Checklist

- [ ] Backend: `npx tsc --noEmit` clean, `npm test` passes (~105)
- [ ] Frontend: `npx tsc --noEmit` clean
- [ ] Frontend: `npm run build` succeeds
- [ ] Manual QA (Task 13) passes
- [ ] Legacy shlokas still playable + editable
- [ ] New shlokas creatable with single full-audio + drag-into-bucket UI
- [ ] No data wipes — existing user completion records intact
