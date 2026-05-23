# Shloka Audio Playback + Lyric Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the shloka audio player so each line plays 3 times then the full shloka plays 3 times, with Devanagari word highlighting synced to the audio. Layout stays the same.

**Architecture:** Pure state-machine reducer + thin React hook (`useShlokaPlayer`) drives audio. JSON data files in `/public/data/` hold shloka text, audio paths, and hand-authored word timestamps. `ShlokaDesc.jsx` keeps its existing JSX shape but consumes the hook and renders Sanskrit lines as word spans that conditionally highlight from `audio.currentTime` polled via `requestAnimationFrame`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4. New dev deps: Vitest + happy-dom (pure-function unit tests only; hook integration is manual QA).

**Spec:** `docs/superpowers/specs/2026-05-23-shloka-audio-highlight-design.md`

---

## File Structure

**Create:**
- `vitest.config.ts` — test runner config
- `public/data/taruna-jwara.json` — shloka data + timestamps
- `src/lib/shloka.types.ts` — TS types
- `src/lib/loadShloka.ts` — fetch + validate JSON
- `src/lib/loadShloka.test.ts`
- `src/app/shloka/[id]/hooks/wordIndex.ts` — pure word-index lookup
- `src/app/shloka/[id]/hooks/wordIndex.test.ts`
- `src/app/shloka/[id]/hooks/playerReducer.ts` — pure state machine
- `src/app/shloka/[id]/hooks/playerReducer.test.ts`
- `src/app/shloka/[id]/hooks/useShlokaPlayer.ts` — React hook (side effects)

**Modify:**
- `package.json` — add test script + deps
- `src/app/shloka/[id]/page.tsx` — fetch JSON, pass to `ShlokaDesc`
- `src/app/shloka/[id]/ShlokaDesc.jsx` — consume hook, accept shloka prop
- `src/app/shloka/[id]/ShlokaDisplay.jsx` — render word spans with conditional highlight

**Delete:**
- `src/app/shloka/[id]/ShlokaPlayerr.jsx` — unused duplicate

---

## Task 1: Set Up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest + happy-dom**

Run:
```bash
npm install --save-dev vitest@^2 happy-dom@^15
```

Expected: deps added to `package.json` devDependencies.

- [ ] **Step 2: Add test script to `package.json`**

Modify `package.json` `scripts` to add `"test": "vitest run"` and `"test:watch": "vitest"`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: Verify vitest runs with no tests**

Run: `npm test`
Expected: exits 0 with "No test files found" or similar (no crash).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: set up vitest with happy-dom for unit tests"
```

---

## Task 2: Define Shloka Types

**Files:**
- Create: `src/lib/shloka.types.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/lib/shloka.types.ts

export interface WordTiming {
  /** Sanskrit (Devanagari) word as it appears in the line text */
  text: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
}

export interface ShlokaLine {
  /** Full Sanskrit line (Devanagari) */
  sanskrit: string;
  /** Romanized transliteration */
  transliteration: string;
  /** Word timings relative to the line MP3 (audio.lines[i]) */
  words: WordTiming[];
  /** Word timings relative to the full MP3 (audio.full) */
  fullTimings: WordTiming[];
}

export interface Shloka {
  id: string;
  title: string;
  meaning: string;
  translation: string;
  audio: {
    /** Path to the full-shloka MP3, e.g. /audio/taruna-jwara/full.mp3 */
    full: string;
    /** Paths to per-line MP3s, indexed by line */
    lines: string[];
  };
  lines: ShlokaLine[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shloka.types.ts
git commit -m "feat: add Shloka data types"
```

---

## Task 3: Create Sample Shloka JSON

Uses existing audio files (`/public/audio/Taruna_Jwara_Full.mp3`, `Navajwara_Part_1.mp3`, `Navajwara_Part_2.mp3`) so no file moves needed. Word timings are **initial estimates** and must be hand-tuned in Task 12.

**Files:**
- Create: `public/data/taruna-jwara.json`

- [ ] **Step 1: Write the JSON**

```json
{
  "id": "taruna-jwara",
  "title": "Nava Jwara or Taruna Jwara Chikitsa",
  "meaning": "Langhana (fasting), swedana (fomentation), kala (waiting period of eight days), yavagu (medicated gruels) and tikta rasa drugs (drugs having bitter taste) and all digestive enhancers of avipakva dosha (untransformed) are prescribed in the taruna jwara (the initial stage of jwara).[142]",
  "translation": "In the early stage of jwara (fever), known as taruna jwara, the treatment includes Langhana (fasting), Swedana (fomentation), Kala (waiting period), Yavagu (medicated gruels), Tikta rasa drugs (bitter herbs), and digestive enhancers for unripe doshas.",
  "audio": {
    "full": "/audio/Taruna_Jwara_Full.mp3",
    "lines": [
      "/audio/Navajwara_Part_1.mp3",
      "/audio/Navajwara_Part_2.mp3"
    ]
  },
  "lines": [
    {
      "sanskrit": "लङ्घनं स्वेदनं कालो यवाग्वस्तिक्तको रसः",
      "transliteration": "laṅghanaṁ svēdanaṁ kālō yavāgvastiktakō rasaḥ",
      "words": [
        { "text": "लङ्घनं",         "start": 0.0, "end": 0.9 },
        { "text": "स्वेदनं",        "start": 0.9, "end": 1.8 },
        { "text": "कालो",          "start": 1.8, "end": 2.4 },
        { "text": "यवाग्वस्तिक्तको", "start": 2.4, "end": 3.6 },
        { "text": "रसः",           "start": 3.6, "end": 4.5 }
      ],
      "fullTimings": [
        { "text": "लङ्घनं",         "start": 0.0, "end": 0.9 },
        { "text": "स्वेदनं",        "start": 0.9, "end": 1.8 },
        { "text": "कालो",          "start": 1.8, "end": 2.4 },
        { "text": "यवाग्वस्तिक्तको", "start": 2.4, "end": 3.6 },
        { "text": "रसः",           "start": 3.6, "end": 4.5 }
      ]
    },
    {
      "sanskrit": "पाचनान्यविपक्वानां दोषाणां तरुणे ज्वरे",
      "transliteration": "pācanānyavipakvānāṁ dōṣāṇāṁ taruṇē jvarē",
      "words": [
        { "text": "पाचनान्यविपक्वानां", "start": 0.0, "end": 1.4 },
        { "text": "दोषाणां",          "start": 1.4, "end": 2.2 },
        { "text": "तरुणे",            "start": 2.2, "end": 2.9 },
        { "text": "ज्वरे",             "start": 2.9, "end": 3.7 }
      ],
      "fullTimings": [
        { "text": "पाचनान्यविपक्वानां", "start": 4.5, "end": 5.9 },
        { "text": "दोषाणां",          "start": 5.9, "end": 6.7 },
        { "text": "तरुणे",            "start": 6.7, "end": 7.4 },
        { "text": "ज्वरे",             "start": 7.4, "end": 8.2 }
      ]
    }
  ]
}
```

Note: timings above are placeholders. Task 13 includes a step to listen to each MP3 and adjust.

- [ ] **Step 2: Verify JSON parses**

Run: `node -e "console.log(Object.keys(require('./public/data/taruna-jwara.json')))"`
Expected: `[ 'id', 'title', 'meaning', 'translation', 'audio', 'lines' ]`

- [ ] **Step 3: Commit**

```bash
git add public/data/taruna-jwara.json
git commit -m "feat: add taruna-jwara shloka data with placeholder word timings"
```

---

## Task 4: Implement `loadShloka`

**Files:**
- Create: `src/lib/loadShloka.ts`
- Test: `src/lib/loadShloka.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/loadShloka.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadShloka } from './loadShloka';

describe('loadShloka', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and returns the shloka JSON', async () => {
    const sample = {
      id: 'taruna-jwara',
      title: 't',
      meaning: 'm',
      translation: 'tr',
      audio: { full: '/a/full.mp3', lines: ['/a/l1.mp3'] },
      lines: [
        {
          sanskrit: 'a b',
          transliteration: 'a b',
          words: [
            { text: 'a', start: 0, end: 1 },
            { text: 'b', start: 1, end: 2 },
          ],
          fullTimings: [
            { text: 'a', start: 0, end: 1 },
            { text: 'b', start: 1, end: 2 },
          ],
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sample,
    }));

    const result = await loadShloka('taruna-jwara');
    expect(result.id).toBe('taruna-jwara');
    expect(result.lines).toHaveLength(1);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await expect(loadShloka('missing')).rejects.toThrow(/missing/);
  });

  it('throws on missing required fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x' }),
    }));

    await expect(loadShloka('x')).rejects.toThrow(/invalid shloka/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- loadShloka`
Expected: FAIL — cannot resolve `./loadShloka`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/loadShloka.ts
import type { Shloka } from './shloka.types';

export async function loadShloka(id: string): Promise<Shloka> {
  const res = await fetch(`/data/${id}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load shloka "${id}" (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (
    !data ||
    typeof data.id !== 'string' ||
    !Array.isArray(data.lines) ||
    !data.audio ||
    typeof data.audio.full !== 'string'
  ) {
    throw new Error('Invalid shloka payload');
  }
  return data as Shloka;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- loadShloka`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/loadShloka.ts src/lib/loadShloka.test.ts
git commit -m "feat: add loadShloka with validation + tests"
```

---

## Task 5: Implement `wordIndex` Pure Function

Given a current time and an array of word timings, return the index of the active word (or -1).

**Files:**
- Create: `src/app/shloka/[id]/hooks/wordIndex.ts`
- Test: `src/app/shloka/[id]/hooks/wordIndex.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/shloka/[id]/hooks/wordIndex.test.ts
import { describe, it, expect } from 'vitest';
import { findWordIndex } from './wordIndex';
import type { WordTiming } from '@/lib/shloka.types';

const timings: WordTiming[] = [
  { text: 'a', start: 0.0, end: 1.0 },
  { text: 'b', start: 1.0, end: 2.0 },
  { text: 'c', start: 2.5, end: 3.0 }, // gap between b and c
];

describe('findWordIndex', () => {
  it('returns 0 at start', () => {
    expect(findWordIndex(0, timings)).toBe(0);
  });

  it('returns correct index mid-word', () => {
    expect(findWordIndex(0.5, timings)).toBe(0);
    expect(findWordIndex(1.5, timings)).toBe(1);
    expect(findWordIndex(2.7, timings)).toBe(2);
  });

  it('returns -1 in a gap between words', () => {
    expect(findWordIndex(2.2, timings)).toBe(-1);
  });

  it('returns -1 after the last word', () => {
    expect(findWordIndex(5.0, timings)).toBe(-1);
  });

  it('returns -1 before the first word', () => {
    expect(findWordIndex(-0.1, timings)).toBe(-1);
  });

  it('returns -1 for empty timings', () => {
    expect(findWordIndex(1, [])).toBe(-1);
  });

  it('treats end as exclusive', () => {
    // exactly at end of word 0 should land in gap or next word
    expect(findWordIndex(1.0, timings)).toBe(1); // start of next is inclusive
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- wordIndex`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/shloka/[id]/hooks/wordIndex.ts
import type { WordTiming } from '@/lib/shloka.types';

/**
 * Returns the index of the word active at time `t`, or -1 if none.
 * A word is active when t >= word.start and t < word.end.
 */
export function findWordIndex(t: number, timings: WordTiming[]): number {
  for (let i = 0; i < timings.length; i++) {
    if (t >= timings[i].start && t < timings[i].end) return i;
  }
  return -1;
}
```

- [ ] **Step 4: Verify tsconfig path alias**

Check `tsconfig.json` already includes `"@/*": ["./src/*"]`. If not, add it under `compilerOptions.paths`. Default Next.js scaffolds do include this; verify before proceeding.

Run: `cat tsconfig.json | grep -A2 paths`
Expected: shows `"@/*": ["./src/*"]`. If missing, add it and rerun.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- wordIndex`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/shloka/[id]/hooks/wordIndex.ts src/app/shloka/[id]/hooks/wordIndex.test.ts
git commit -m "feat: add findWordIndex pure function with tests"
```

---

## Task 6: Implement `playerReducer` State Machine

Pure reducer for the audio state machine. No DOM, no audio refs, no timers — those are side effects in the hook.

**Files:**
- Create: `src/app/shloka/[id]/hooks/playerReducer.ts`

- [ ] **Step 1: Write the reducer**

```ts
// src/app/shloka/[id]/hooks/playerReducer.ts

export const REPETITIONS = 3;

export type PlayerState =
  | { status: 'IDLE' }
  | { status: 'PLAYING_LINE'; line: number; rep: number }
  | { status: 'PLAYING_FULL'; rep: number }
  | { status: 'PAUSING_REP'; mode: 'LINE' | 'FULL'; line: number; rep: number }
  | { status: 'PAUSING_LINE'; nextLine: number }
  | { status: 'PAUSING_FULL' }
  | { status: 'PAUSED'; prev: PlayerState }
  | { status: 'DONE' };

export type PlayerEvent =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'AUDIO_ENDED' }
  | { type: 'TIMER_DONE' }
  | { type: 'SKIP_NEXT' }
  | { type: 'SKIP_PREV' };

export interface ReducerCtx {
  totalLines: number;
}

export function playerReducer(
  state: PlayerState,
  event: PlayerEvent,
  ctx: ReducerCtx,
): PlayerState {
  switch (event.type) {
    case 'PLAY':
      if (state.status === 'IDLE' || state.status === 'DONE') {
        return { status: 'PLAYING_LINE', line: 0, rep: 1 };
      }
      return state;

    case 'PAUSE':
      if (
        state.status === 'PLAYING_LINE' ||
        state.status === 'PLAYING_FULL' ||
        state.status === 'PAUSING_REP' ||
        state.status === 'PAUSING_LINE' ||
        state.status === 'PAUSING_FULL'
      ) {
        return { status: 'PAUSED', prev: state };
      }
      return state;

    case 'RESUME':
      if (state.status === 'PAUSED') return state.prev;
      return state;

    case 'RESET':
      return { status: 'IDLE' };

    case 'AUDIO_ENDED':
      if (state.status === 'PLAYING_LINE') {
        if (state.rep < REPETITIONS) {
          return { status: 'PAUSING_REP', mode: 'LINE', line: state.line, rep: state.rep };
        }
        if (state.line < ctx.totalLines - 1) {
          return { status: 'PAUSING_LINE', nextLine: state.line + 1 };
        }
        return { status: 'PAUSING_FULL' };
      }
      if (state.status === 'PLAYING_FULL') {
        if (state.rep < REPETITIONS) {
          return { status: 'PAUSING_REP', mode: 'FULL', line: 0, rep: state.rep };
        }
        return { status: 'DONE' };
      }
      return state;

    case 'TIMER_DONE':
      if (state.status === 'PAUSING_REP') {
        return state.mode === 'LINE'
          ? { status: 'PLAYING_LINE', line: state.line, rep: state.rep + 1 }
          : { status: 'PLAYING_FULL', rep: state.rep + 1 };
      }
      if (state.status === 'PAUSING_LINE') {
        return { status: 'PLAYING_LINE', line: state.nextLine, rep: 1 };
      }
      if (state.status === 'PAUSING_FULL') {
        return { status: 'PLAYING_FULL', rep: 1 };
      }
      return state;

    case 'SKIP_NEXT':
      if (state.status === 'PLAYING_LINE' && state.line < ctx.totalLines - 1) {
        return { status: 'PLAYING_LINE', line: state.line + 1, rep: 1 };
      }
      if (state.status === 'PLAYING_LINE' && state.line === ctx.totalLines - 1) {
        return { status: 'PLAYING_FULL', rep: 1 };
      }
      return state;

    case 'SKIP_PREV':
      if (state.status === 'PLAYING_LINE' && state.line > 0) {
        return { status: 'PLAYING_LINE', line: state.line - 1, rep: 1 };
      }
      if (state.status === 'PLAYING_FULL') {
        return { status: 'PLAYING_LINE', line: ctx.totalLines - 1, rep: 1 };
      }
      return state;

    default:
      return state;
  }
}

export const initialState: PlayerState = { status: 'IDLE' };
```

- [ ] **Step 2: Commit (will be tested in Task 7)**

```bash
git add src/app/shloka/[id]/hooks/playerReducer.ts
git commit -m "feat: add player state machine reducer"
```

---

## Task 7: Test `playerReducer`

**Files:**
- Test: `src/app/shloka/[id]/hooks/playerReducer.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// src/app/shloka/[id]/hooks/playerReducer.test.ts
import { describe, it, expect } from 'vitest';
import {
  playerReducer,
  initialState,
  REPETITIONS,
  type PlayerState,
  type PlayerEvent,
} from './playerReducer';

const CTX = { totalLines: 2 };

function run(state: PlayerState, events: PlayerEvent[]): PlayerState {
  return events.reduce((s, e) => playerReducer(s, e, CTX), state);
}

describe('playerReducer', () => {
  it('starts in IDLE', () => {
    expect(initialState).toEqual({ status: 'IDLE' });
  });

  it('PLAY from IDLE → PLAYING_LINE line 0 rep 1', () => {
    expect(playerReducer(initialState, { type: 'PLAY' }, CTX)).toEqual({
      status: 'PLAYING_LINE',
      line: 0,
      rep: 1,
    });
  });

  it('AUDIO_ENDED on rep < 3 in line mode → PAUSING_REP', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: 1 };
    expect(playerReducer(s, { type: 'AUDIO_ENDED' }, CTX)).toEqual({
      status: 'PAUSING_REP',
      mode: 'LINE',
      line: 0,
      rep: 1,
    });
  });

  it('TIMER_DONE from PAUSING_REP line → next rep', () => {
    const s: PlayerState = { status: 'PAUSING_REP', mode: 'LINE', line: 0, rep: 1 };
    expect(playerReducer(s, { type: 'TIMER_DONE' }, CTX)).toEqual({
      status: 'PLAYING_LINE',
      line: 0,
      rep: 2,
    });
  });

  it('AUDIO_ENDED on last rep of line, more lines → PAUSING_LINE', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: REPETITIONS };
    expect(playerReducer(s, { type: 'AUDIO_ENDED' }, CTX)).toEqual({
      status: 'PAUSING_LINE',
      nextLine: 1,
    });
  });

  it('AUDIO_ENDED on last rep of last line → PAUSING_FULL', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 1, rep: REPETITIONS };
    expect(playerReducer(s, { type: 'AUDIO_ENDED' }, CTX)).toEqual({
      status: 'PAUSING_FULL',
    });
  });

  it('TIMER_DONE from PAUSING_FULL → PLAYING_FULL rep 1', () => {
    const s: PlayerState = { status: 'PAUSING_FULL' };
    expect(playerReducer(s, { type: 'TIMER_DONE' }, CTX)).toEqual({
      status: 'PLAYING_FULL',
      rep: 1,
    });
  });

  it('AUDIO_ENDED on full last rep → DONE', () => {
    const s: PlayerState = { status: 'PLAYING_FULL', rep: REPETITIONS };
    expect(playerReducer(s, { type: 'AUDIO_ENDED' }, CTX)).toEqual({ status: 'DONE' });
  });

  it('full sequence: PLAY → all reps → DONE', () => {
    // 2 lines × 3 reps + full × 3 reps
    let s: PlayerState = initialState;
    s = playerReducer(s, { type: 'PLAY' }, CTX); // PLAYING_LINE 0 rep 1

    // Line 0: 3 reps
    for (let r = 1; r <= REPETITIONS; r++) {
      expect(s).toMatchObject({ status: 'PLAYING_LINE', line: 0, rep: r });
      s = playerReducer(s, { type: 'AUDIO_ENDED' }, CTX);
      if (r < REPETITIONS) {
        expect(s.status).toBe('PAUSING_REP');
        s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);
      }
    }
    // After line 0 last rep, expect PAUSING_LINE → next line
    expect(s).toEqual({ status: 'PAUSING_LINE', nextLine: 1 });
    s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);

    // Line 1: 3 reps
    for (let r = 1; r <= REPETITIONS; r++) {
      expect(s).toMatchObject({ status: 'PLAYING_LINE', line: 1, rep: r });
      s = playerReducer(s, { type: 'AUDIO_ENDED' }, CTX);
      if (r < REPETITIONS) {
        s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);
      }
    }
    // After last line last rep, expect PAUSING_FULL
    expect(s).toEqual({ status: 'PAUSING_FULL' });
    s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);

    // Full: 3 reps
    for (let r = 1; r <= REPETITIONS; r++) {
      expect(s).toMatchObject({ status: 'PLAYING_FULL', rep: r });
      s = playerReducer(s, { type: 'AUDIO_ENDED' }, CTX);
      if (r < REPETITIONS) {
        s = playerReducer(s, { type: 'TIMER_DONE' }, CTX);
      }
    }
    expect(s).toEqual({ status: 'DONE' });
  });

  it('PAUSE then RESUME restores previous state', () => {
    const s1: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: 2 };
    const s2 = playerReducer(s1, { type: 'PAUSE' }, CTX);
    expect(s2).toEqual({ status: 'PAUSED', prev: s1 });
    const s3 = playerReducer(s2, { type: 'RESUME' }, CTX);
    expect(s3).toEqual(s1);
  });

  it('SKIP_NEXT in middle line → next line rep 1', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: 2 };
    expect(playerReducer(s, { type: 'SKIP_NEXT' }, CTX)).toEqual({
      status: 'PLAYING_LINE',
      line: 1,
      rep: 1,
    });
  });

  it('SKIP_NEXT on last line → PLAYING_FULL rep 1', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 1, rep: 2 };
    expect(playerReducer(s, { type: 'SKIP_NEXT' }, CTX)).toEqual({
      status: 'PLAYING_FULL',
      rep: 1,
    });
  });

  it('SKIP_PREV in line 0 stays', () => {
    const s: PlayerState = { status: 'PLAYING_LINE', line: 0, rep: 2 };
    expect(playerReducer(s, { type: 'SKIP_PREV' }, CTX)).toEqual(s);
  });

  it('SKIP_PREV from PLAYING_FULL → last line rep 1', () => {
    const s: PlayerState = { status: 'PLAYING_FULL', rep: 2 };
    expect(playerReducer(s, { type: 'SKIP_PREV' }, CTX)).toEqual({
      status: 'PLAYING_LINE',
      line: 1,
      rep: 1,
    });
  });

  it('RESET from any state → IDLE', () => {
    const s: PlayerState = { status: 'PLAYING_FULL', rep: 2 };
    expect(playerReducer(s, { type: 'RESET' }, CTX)).toEqual({ status: 'IDLE' });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- playerReducer`
Expected: PASS (all 14+ tests).

- [ ] **Step 3: Commit**

```bash
git add src/app/shloka/[id]/hooks/playerReducer.test.ts
git commit -m "test: cover playerReducer state transitions"
```

---

## Task 8: Implement `useShlokaPlayer` Hook

Thin React wrapper around the reducer. Owns audio element ref, timer, and RAF loop for word highlighting.

**Files:**
- Create: `src/app/shloka/[id]/hooks/useShlokaPlayer.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/app/shloka/[id]/hooks/useShlokaPlayer.ts
'use client';

import { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import type { Shloka, WordTiming } from '@/lib/shloka.types';
import { findWordIndex } from './wordIndex';
import {
  playerReducer,
  initialState,
  REPETITIONS,
  type PlayerState,
  type PlayerEvent,
} from './playerReducer';

const PAUSE_MS = 500;

export interface ShlokaPlayerApi {
  state: PlayerState;
  /** Index of the line currently emphasized (-1 when none). */
  currentLine: number;
  /** Index of the word currently highlighted within currentLine (-1 when none). */
  currentWordIndex: number;
  /** Current repetition (1..REPETITIONS) when playing, else 0. */
  rep: number;
  totalLines: number;
  REPETITIONS: number;
  /** True while audio is actively playing (any line or full). */
  isPlaying: boolean;
  /** Element ref to attach to a single <audio> tag in the component. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** URL the <audio src> should currently use. */
  currentSrc: string | null;
  play: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skipNext: () => void;
  skipPrev: () => void;
}

export function useShlokaPlayer(shloka: Shloka): ShlokaPlayerApi {
  const ctx = { totalLines: shloka.lines.length };
  const reducer = useCallback(
    (s: PlayerState, e: PlayerEvent) => playerReducer(s, e, ctx),
    [ctx.totalLines],
  );
  const [state, dispatch] = useReducer(reducer, initialState);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [currentLineDuringFull, setCurrentLineDuringFull] = useState(0);

  // Derive currentLine + currentSrc from state
  const currentLine =
    state.status === 'PLAYING_LINE' || state.status === 'PAUSING_REP' && state.mode === 'LINE'
      ? state.line
      : state.status === 'PLAYING_FULL' || (state.status === 'PAUSING_REP' && state.mode === 'FULL')
        ? currentLineDuringFull
        : state.status === 'PAUSING_LINE'
          ? state.nextLine
          : state.status === 'PAUSED'
            ? deriveCurrentLine(state.prev, currentLineDuringFull)
            : -1;

  const currentSrc =
    state.status === 'PLAYING_LINE' || (state.status === 'PAUSING_REP' && state.mode === 'LINE')
      ? shloka.audio.lines[state.line]
      : state.status === 'PLAYING_FULL' || (state.status === 'PAUSING_REP' && state.mode === 'FULL')
        ? shloka.audio.full
        : state.status === 'PAUSING_LINE'
          ? shloka.audio.lines[state.nextLine]
          : state.status === 'PAUSING_FULL'
            ? shloka.audio.full
            : null;

  const rep =
    state.status === 'PLAYING_LINE' || state.status === 'PLAYING_FULL'
      ? state.rep
      : state.status === 'PAUSING_REP'
        ? state.rep
        : 0;

  const isPlaying = state.status === 'PLAYING_LINE' || state.status === 'PLAYING_FULL';

  // Side effect: drive audio playback based on state
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    if (state.status === 'PLAYING_LINE' || state.status === 'PLAYING_FULL') {
      // Always restart from 0 when entering a playing state
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked or aborted */ });
    } else {
      a.pause();
    }
  }, [state.status, state.status === 'PLAYING_LINE' ? state.line : null, state.status === 'PLAYING_LINE' ? state.rep : null, state.status === 'PLAYING_FULL' ? state.rep : null]);

  // Side effect: pause timers
  useEffect(() => {
    if (
      state.status === 'PAUSING_REP' ||
      state.status === 'PAUSING_LINE' ||
      state.status === 'PAUSING_FULL'
    ) {
      timerRef.current = setTimeout(() => dispatch({ type: 'TIMER_DONE' }), PAUSE_MS);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
      };
    }
  }, [state.status]);

  // Side effect: AUDIO_ENDED dispatch (also on error so we don't get stuck)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnded = () => dispatch({ type: 'AUDIO_ENDED' });
    const onError = () => {
      console.warn('Audio failed to load/play; advancing.');
      dispatch({ type: 'AUDIO_ENDED' });
    };
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
    };
  }, []);

  // Side effect: word highlight via RAF
  useEffect(() => {
    if (state.status !== 'PLAYING_LINE' && state.status !== 'PLAYING_FULL') {
      setCurrentWordIndex(-1);
      return;
    }

    let active = true;
    const tick = () => {
      if (!active) return;
      const a = audioRef.current;
      if (!a) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = a.currentTime;

      if (state.status === 'PLAYING_LINE') {
        const idx = findWordIndex(t, shloka.lines[state.line].words);
        setCurrentWordIndex(prev => (prev === idx ? prev : idx));
      } else {
        // PLAYING_FULL: find which line + which word within it
        let foundLine = -1;
        let foundWord = -1;
        for (let li = 0; li < shloka.lines.length; li++) {
          const widx = findWordIndex(t, shloka.lines[li].fullTimings);
          if (widx !== -1) {
            foundLine = li;
            foundWord = widx;
            break;
          }
        }
        if (foundLine !== -1) {
          setCurrentLineDuringFull(prev => (prev === foundLine ? prev : foundLine));
        }
        setCurrentWordIndex(prev => (prev === foundWord ? prev : foundWord));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [state.status, state.status === 'PLAYING_LINE' ? state.line : -1, shloka]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  return {
    state,
    currentLine,
    currentWordIndex,
    rep,
    totalLines: shloka.lines.length,
    REPETITIONS,
    isPlaying,
    audioRef,
    currentSrc,
    play: () => dispatch({ type: 'PLAY' }),
    pause: () => dispatch({ type: 'PAUSE' }),
    resume: () => dispatch({ type: 'RESUME' }),
    reset: () => dispatch({ type: 'RESET' }),
    skipNext: () => dispatch({ type: 'SKIP_NEXT' }),
    skipPrev: () => dispatch({ type: 'SKIP_PREV' }),
  };
}

function deriveCurrentLine(prev: PlayerState, fallbackFullLine: number): number {
  if (prev.status === 'PLAYING_LINE' || (prev.status === 'PAUSING_REP' && prev.mode === 'LINE')) {
    return prev.line;
  }
  if (prev.status === 'PLAYING_FULL' || (prev.status === 'PAUSING_REP' && prev.mode === 'FULL')) {
    return fallbackFullLine;
  }
  if (prev.status === 'PAUSING_LINE') return prev.nextLine;
  return -1;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/shloka/[id]/hooks/useShlokaPlayer.ts
git commit -m "feat: add useShlokaPlayer hook with audio side effects + RAF highlight sync"
```

---

## Task 9: Refactor `ShlokaDisplay.jsx` to Render Word Spans

Keep layout identical. Replace whole-line text with word spans that conditionally highlight.

**Files:**
- Modify: `src/app/shloka/[id]/ShlokaDisplay.jsx`

- [ ] **Step 1: Replace file contents**

```jsx
// src/app/shloka/[id]/ShlokaDisplay.jsx
"use client";

import React from "react";

/**
 * Renders the active Sanskrit line (or full shloka) with per-word highlight.
 * Layout matches the previous version; only inner content changes from
 * a plain <p>{line}</p> to a span-per-word with conditional bg.
 *
 * Props:
 *   shloka            — Shloka object (new shape from /public/data)
 *   activeLine        — index of line to emphasize
 *   currentWordIndex  — index of word within activeLine to highlight, or -1
 *   rep               — current repetition (0 when not playing)
 *   maxReps           — total repetitions configured
 *   playingFull       — when true, show all lines stacked (current line emphasized)
 */
const ShlokaDisplay = ({
  shloka,
  activeLine,
  currentWordIndex,
  rep,
  maxReps,
  playingFull,
}) => {
  const renderLine = (line, lineIndex) => {
    const words = line.sanskrit.split(/\s+/).filter(Boolean);
    const isActive = lineIndex === activeLine;
    return (
      <p
        key={lineIndex}
        className={
          isActive
            ? "text-2xl px-4 bg-primary-light-1 w-full"
            : "text-2xl px-4 w-full opacity-40"
        }
      >
        {words.map((w, wi) => (
          <span
            key={wi}
            className={
              isActive && wi === currentWordIndex
                ? "bg-yellow-200 rounded px-1 transition-colors duration-150"
                : ""
            }
          >
            {w}{wi < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    );
  };

  return (
    <div className="bg-white p-3 text-center place-items-center space-y-2 w-full">
      {playingFull ? (
        <div>
          {shloka.lines.map((line, i) => renderLine(line, i))}
          <h3>{shloka.lines.map((l) => l.transliteration).join(" ")}</h3>
        </div>
      ) : (
        shloka.lines.map((line, i) =>
          activeLine === i ? (
            <React.Fragment key={i}>
              {renderLine(line, i)}
              <h3>{line.transliteration}</h3>
            </React.Fragment>
          ) : null,
        )
      )}

      <p className="bg-grey-100 w-fit text-[10px] rounded-2xl px-2">
        Line {activeLine + 1} of {shloka.lines.length} · Repetition {rep || 0} / {maxReps}
      </p>
    </div>
  );
};

export default ShlokaDisplay;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/shloka/[id]/ShlokaDisplay.jsx
git commit -m "feat: render Sanskrit lines as word spans with conditional highlight"
```

---

## Task 10: Refactor `ShlokaDesc.jsx` to Use the Hook

Same JSX shape and styling. Only internal wiring changes: hook drives state, single `<audio>` tag uses `currentSrc`, controls dispatch hook actions.

**Files:**
- Modify: `src/app/shloka/[id]/ShlokaDesc.jsx`

- [ ] **Step 1: Replace file contents**

```jsx
// src/app/shloka/[id]/ShlokaDesc.jsx
"use client";

import { Heart } from "lucide-react";
import Image from "next/image";
import React from "react";
import ShlokaDisplay from "./ShlokaDisplay";
import { MdOutlineSkipPrevious, MdPlayArrow, MdSkipNext } from "react-icons/md";
import { CiPause1 } from "react-icons/ci";
import { BiHide } from "react-icons/bi";
import { useShlokaPlayer } from "./hooks/useShlokaPlayer";

const ShlokaDesc = ({ shloka }) => {
  const player = useShlokaPlayer(shloka);

  const playingFull =
    player.state.status === "PLAYING_FULL" ||
    (player.state.status === "PAUSING_REP" && player.state.mode === "FULL") ||
    player.state.status === "PAUSING_FULL" ||
    (player.state.status === "PAUSED" &&
      (player.state.prev.status === "PLAYING_FULL" ||
        player.state.prev.status === "PAUSING_FULL" ||
        (player.state.prev.status === "PAUSING_REP" && player.state.prev.mode === "FULL")));

  const handlePlayPause = () => {
    if (player.state.status === "IDLE" || player.state.status === "DONE") {
      player.play();
    } else if (player.state.status === "PAUSED") {
      player.resume();
    } else {
      player.pause();
    }
  };

  return (
    <div className="p-10">
      <p>Back to all shlokas</p>
      <div className="grid md:grid-cols-6 gap-4">
        {/* Right Side */}
        <div className="col-span-4 space-y-4">
          {/* Shloka Heading */}
          <div className="relative flex flex-col items-center w-full">
            <div className="h-64 w-full flex justify-center z-5">
              <div className="black-overlay rounded-lg"></div>
              <Image
                src={"/images/shloka_img_2.jpg"}
                alt="Shloka"
                width={1400}
                height={240}
                className="rounded-lg w-full object-cover h-full"
              />
              <div className="flex items-center justify-between absolute bottom-4 left-3 text-left w-full text-white">
                <div>
                  <h1 className="text-2xl">{shloka.title}</h1>
                  <p className="text-xs">
                    Guiding the Early Healing of Fever through Detox and Lightness
                  </p>
                </div>
                <Heart size={18} className="absolute right-6 bottom-1" />
              </div>
            </div>
          </div>

          {/* Shloka body */}
          <div className="bg-white p-3 text-center place-items-center space-y-2 w-full">
            <ShlokaDisplay
              shloka={shloka}
              activeLine={Math.max(0, player.currentLine)}
              currentWordIndex={player.currentWordIndex}
              rep={player.rep}
              maxReps={player.REPETITIONS}
              playingFull={playingFull}
            />

            <button
              onClick={handlePlayPause}
              className="cursor-pointer bg-indigo-100/50 text-black/40 hover:text-black hover:bg-green-100 px-5 py-1 rounded-2xl"
            >
              {player.state.status === "IDLE" || player.state.status === "DONE"
                ? "Play"
                : player.state.status === "PAUSED"
                  ? "Resume"
                  : "Pause"}
            </button>

            {/* Single audio element driven by hook */}
            <audio ref={player.audioRef} src={player.currentSrc ?? undefined} />
          </div>

          {/* Skip / Play / Skip */}
          <div className="bg-white/50 hover:bg-white p-10 space-y-5">
            <div className="flex justify-center items-center space-x-4">
              <MdOutlineSkipPrevious
                onClick={player.skipPrev}
                size={28}
                className="cursor-pointer bg-indigo-100/40 text-black/40 hover:text-black hover:bg-indigo-100 p-1 rounded-2xl"
              />
              {player.isPlaying ? (
                <CiPause1
                  onClick={player.pause}
                  size={28}
                  className="cursor-pointer bg-green-100/50 text-black/40 hover:text-black hover:bg-green-100 p-1 rounded-2xl"
                />
              ) : (
                <MdPlayArrow
                  onClick={handlePlayPause}
                  size={28}
                  className="cursor-pointer bg-green-100/50 text-black/40 hover:text-black hover:bg-green-100 p-1 rounded-2xl"
                />
              )}
              <MdSkipNext
                onClick={player.skipNext}
                size={28}
                className="cursor-pointer bg-indigo-100/40 text-black/40 hover:text-black hover:bg-indigo-100 p-1 rounded-2xl"
              />
              <BiHide
                size={28}
                className="cursor-pointer bg-red-100/50 text-black/40 hover:text-black hover:bg-red-100 p-1 rounded-2xl"
              />
            </div>
            <div className="bg-grey-50 h-1"></div>
          </div>
        </div>

        {/* Left Side */}
        <div className="col-span-2 space-y-5">
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h2 className="text-xl text-brown">Meaning</h2>
            <p className="text-sm">{shloka.translation}</p>
            <p className="text-sm">{shloka.meaning}</p>
          </div>
          <div className="bg-white/60 p-4 rounded-lg">
            <h5 className="text-brown">Lines:</h5>
            {shloka.lines.map((line, i) => (
              <p
                key={i}
                className={i === 0 ? "" : "text-sm text-gray-400"}
              >
                {line.sanskrit}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShlokaDesc;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/shloka/[id]/ShlokaDesc.jsx
git commit -m "refactor: wire ShlokaDesc to useShlokaPlayer hook"
```

---

## Task 11: Update `page.tsx` to Load JSON

Page becomes a client component that fetches the JSON and renders `ShlokaDesc` with the result, plus loading + error states.

**Files:**
- Modify: `src/app/shloka/[id]/page.tsx`

- [ ] **Step 1: Replace file contents**

```tsx
// src/app/shloka/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import ShlokaDesc from "./ShlokaDesc";
import { loadShloka } from "@/lib/loadShloka";
import type { Shloka } from "@/lib/shloka.types";
import { useParams } from "next/navigation";

const Page = () => {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "taruna-jwara"; // fallback while only one shloka exists
  const [shloka, setShloka] = useState<Shloka | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setShloka(null);
    loadShloka(id)
      .then((s) => {
        if (!cancelled) setShloka(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load shloka");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="p-10">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => location.reload()}
          className="mt-2 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!shloka) {
    return <div className="p-10">Loading…</div>;
  }

  return <ShlokaDesc shloka={shloka} />;
};

export default Page;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/shloka/[id]/page.tsx
git commit -m "feat: load shloka JSON in page component with loading + error states"
```

---

## Task 12: Delete Duplicate Player

**Files:**
- Delete: `src/app/shloka/[id]/ShlokaPlayerr.jsx`

- [ ] **Step 1: Confirm no imports**

Run: `grep -r "ShlokaPlayerr" src/ --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js"`
Expected: no matches.

- [ ] **Step 2: Delete the file**

Run: `git rm src/app/shloka/[id]/ShlokaPlayerr.jsx`

- [ ] **Step 3: Verify build succeeds**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove unused duplicate ShlokaPlayerr"
```

---

## Task 13: Manual QA + Timing Calibration

This is a manual step. No code changes unless bugs surface.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: server up on http://localhost:3000.

- [ ] **Step 2: Visit `/shloka/taruna-jwara`**

Open the route in a browser.
Expected: loading flash, then shloka page renders with no console errors.

- [ ] **Step 3: Click Play and observe full sequence**

Expected:
- Line 1 plays 3 times with ~500ms pause between reps
- Then Line 2 plays 3 times
- Then full shloka plays 3 times
- Then state shows Play button again

Note the current line emphasis in the lyrics area updates as it advances.

- [ ] **Step 4: Verify word highlight tracks audio**

During each line and during full playback, the Sanskrit word currently being spoken should have a yellow highlight that moves with the audio.

**If timings are off:** open `public/data/taruna-jwara.json`, listen to each MP3 (e.g. `afplay public/audio/Navajwara_Part_1.mp3` on macOS), note word boundaries in seconds, and adjust the `words` (line MP3 timing) and `fullTimings` (full MP3 timing) arrays. Reload the browser after each save.

- [ ] **Step 5: Test pause/resume**

Click Pause mid-line. Expected: audio stops, highlight freezes on current word.
Click Resume. Expected: audio resumes from where it stopped (the same line — when state was PAUSED → PLAYING_LINE, the effect restarts from 0 of the line; this is acceptable since the line is short and will be repeated).

- [ ] **Step 6: Test skip prev/next**

Click skip-next during line playback. Expected: advances to next line, rep counter resets to 1.
Click skip-prev. Expected: goes back. From full mode, skip-prev returns to the last line.

- [ ] **Step 7: Commit calibrated timings if changed**

```bash
git add public/data/taruna-jwara.json
git commit -m "tune: calibrate word timings for taruna-jwara audio"
```

---

## Verification Checklist

After all tasks complete, run:

- [ ] `npm test` — all unit tests pass
- [ ] `npm run lint` — clean
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds
- [ ] Manual QA from Task 13 passes end-to-end
