# Shloka Audio Playback + Karaoke Highlighting

**Status:** Draft
**Date:** 2026-05-23
**Scope:** `/shloka/[id]` page only. No layout changes.

## Goal

Refactor the existing shloka audio player so that:

1. On **Play**, each line plays N times (default 3), then the full shloka plays N times. Sequence: `Line1 x3 → Line2 x3 → ... → LineN x3 → Full x3 → Done`.
2. The current Sanskrit (Devanagari) word is **highlighted in real time** as the audio plays — Spotify-style karaoke.

The existing layout, controls, and visual structure stay the same. This is a logic + highlight feature, not a redesign.

## Non-Goals

- No new UI sections, no layout shifts, no new pages.
- No backend, no auth, no user-adjustable repeat counter.
- No transliteration or translation highlight (Sanskrit only).
- No forced-alignment tooling — timestamps are authored by hand.

## Constraints

- Next.js 15 + React 19 + Tailwind 4 (existing stack).
- One shloka exists today (`Taruna Jwara`); design must scale to many.
- Two duplicate player files exist (`ShlokaDesc.jsx`, `ShlokaPlayerr.jsx`) — keep `ShlokaDesc.jsx`'s layout, remove `ShlokaPlayerr.jsx`.

## Decisions

| Topic | Choice |
|---|---|
| Sequence | Lines first (each x3), then full (x3) |
| Repeat count | Hardcoded constant `REPETITIONS = 3` |
| Pause between repeats | 500ms |
| Counter visible | "Line 1/4 · Rep 2/3" badge |
| Timing source | Manual JSON per shloka |
| Highlight scope | Sanskrit (Devanagari) only |
| Data location | `/public/data/<shloka-id>.json` |
| Architecture | Custom hook `useShlokaPlayer` |
| Layout | **Unchanged** from current `ShlokaDesc.jsx` |

## Architecture

```
src/app/shloka/[id]/
├── page.tsx              fetches JSON, passes data to ShlokaDesc
├── ShlokaDesc.jsx        existing layout, refactored to consume hook
└── hooks/
    └── useShlokaPlayer.ts  state machine + audio + highlight sync

src/lib/
├── shloka.types.ts       TS types for shloka JSON
└── loadShloka.ts         fetch + validate JSON

public/data/
└── taruna-jwara.json     shloka data + timestamps

public/audio/taruna-jwara/
├── line-1.mp3
├── line-2.mp3
├── ...
└── full.mp3
```

**What changes in `ShlokaDesc.jsx`:**
- Replace inline `useRef` audio logic with `useShlokaPlayer(shloka)` call.
- Replace inline shloka object with prop received from `page.tsx`.
- Wrap each Sanskrit word in a `<span>` with conditional highlight class.
- Add small "Line X/N · Rep Y/3" badge near existing controls (no layout shift — fits in current control row).

**What does NOT change:**
- Component tree, sidebar, meaning panel, translation area, color scheme, fonts, spacing, button positions.

## Data Shape

```ts
// src/lib/shloka.types.ts
export interface WordTiming {
  text: string;        // Devanagari word
  start: number;       // seconds
  end: number;
}

export interface ShlokaLine {
  sanskrit: string;              // full line text
  transliteration: string;       // static, not highlighted
  words: WordTiming[];           // timings relative to line MP3
  fullTimings: WordTiming[];     // timings relative to full MP3
}

export interface Shloka {
  id: string;
  title: string;
  meaning: string;
  translation: string;
  audio: {
    full: string;                // /audio/.../full.mp3
    lines: string[];             // /audio/.../line-N.mp3
  };
  lines: ShlokaLine[];
}
```

Two timing arrays per line because a line standalone vs. inside the full recitation have different paces. Both authored by hand.

## State Machine

```
states:
  IDLE
  PLAYING_LINE       (audio playing, line mode)
  PLAYING_FULL       (audio playing, full mode)
  PAUSING_REP        (500ms wait before next rep of same audio)
  PAUSING_LINE       (500ms wait before moving to next line)
  PAUSING_FULL       (500ms wait before switching from lines to full)
  PAUSED             (user-initiated; stores prev state)
  DONE

events:
  PLAY, PAUSE, RESUME, RESET
  AUDIO_ENDED, PAUSE_TIMER_DONE
  SKIP_NEXT, SKIP_PREV

context:
  currentLine: number      // 0-indexed
  rep: number              // 1..REPETITIONS
  currentWordIndex: number // -1 if none
```

Transitions:

| From | Event | Condition | To | Side effect |
|---|---|---|---|---|
| IDLE | PLAY | — | PLAYING_LINE | load line[0], rep=1, play |
| PLAYING_LINE | AUDIO_ENDED | rep < 3 | PAUSING_REP | start 500ms timer |
| PLAYING_LINE | AUDIO_ENDED | rep == 3, more lines | PAUSING_LINE | timer |
| PLAYING_LINE | AUDIO_ENDED | rep == 3, last line | PAUSING_FULL | timer |
| PLAYING_FULL | AUDIO_ENDED | rep < 3 | PAUSING_REP | timer |
| PLAYING_FULL | AUDIO_ENDED | rep == 3 | DONE | — |
| PAUSING_REP | PAUSE_TIMER_DONE | line mode | PLAYING_LINE | rep++, replay |
| PAUSING_REP | PAUSE_TIMER_DONE | full mode | PLAYING_FULL | rep++, replay |
| PAUSING_LINE | PAUSE_TIMER_DONE | — | PLAYING_LINE | line++, rep=1, load + play |
| PAUSING_FULL | PAUSE_TIMER_DONE | — | PLAYING_FULL | load full, rep=1, play |
| any playing/pausing | PAUSE | — | PAUSED | stash prev state, pause audio, clear timer |
| PAUSED | RESUME | — | prev state | resume audio or restart timer |
| any | RESET | — | IDLE | clear all, line=0, rep=1 |
| any line state | SKIP_NEXT | not last line | PLAYING_LINE | line++, rep=1 |
| any line state | SKIP_PREV | not first line | PLAYING_LINE | line--, rep=1 |
| PLAYING_FULL | SKIP_PREV | — | PLAYING_LINE | line=last, rep=1 (back to lines) |

## Word Highlight Sync

Hook tracks `currentWordIndex` via `requestAnimationFrame` polling `audio.currentTime`:

```ts
useEffect(() => {
  if (state !== 'PLAYING_LINE' && state !== 'PLAYING_FULL') {
    setCurrentWordIndex(-1);
    return;
  }
  let rafId: number;
  const tick = () => {
    const t = audioRef.current.currentTime;
    const timings = state === 'PLAYING_LINE'
      ? shloka.lines[currentLine].words
      : flattenedFullTimings;  // [...line0.fullTimings, ...line1.fullTimings, ...]
    const idx = timings.findIndex(w => t >= w.start && t < w.end);
    if (idx !== currentWordIndex) setCurrentWordIndex(idx);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}, [state, currentLine]);
```

In `PLAYING_FULL`, also derive `currentLine` from the playhead (which line's timings contain `t`) so the correct line gets emphasized while the word inside it highlights.

## Highlight Rendering

Per Sanskrit line, split into word spans:

```jsx
{line.sanskrit.split(/\s+/).map((word, i) => (
  <span
    key={i}
    className={
      i === currentWordIndex && lineIndex === currentLine
        ? 'bg-yellow-200 transition-colors duration-150 rounded px-1'
        : ''
    }
  >
    {word}{' '}
  </span>
))}
```

The exact class is a placeholder — match existing color palette (use a `--bg-primary-light1` peach or a soft brown from `globals.css`). Decided during implementation, not part of layout.

Word array from `line.sanskrit.split(/\s+/)` must match `line.words.length`. Validated at JSON load; if mismatch, fall back to line-level highlight (whole line tinted, no word sync) and log a console warning.

## Error Handling

| Failure | Behavior |
|---|---|
| JSON fetch fails | Render error state with retry button; no audio controls. |
| Audio file 404 / decode error | Toast "Audio unavailable for this line"; advance state machine as if AUDIO_ENDED (don't get stuck). |
| Timings missing for a line | Fall back to line-level highlight (no word sync) for that line. Console warn. |
| Word count mismatch (text vs `words[]`) | Same fallback as missing timings. |
| User navigates away mid-playback | `useEffect` cleanup: pause audio, clear timers, cancel RAF. |
| Browser blocks autoplay | Play only fires on user click — already user-initiated, so non-issue. |

## Testing

- **Unit (hook logic):** `renderHook(useShlokaPlayer)`. Mock `<audio>` and timers. Assert:
  - Full sequence runs Line1 x3 → Line2 x3 → Full x3 → DONE.
  - PAUSE then RESUME restores previous state.
  - SKIP_NEXT / SKIP_PREV update `currentLine`, reset `rep`.
  - 500ms pause fires between reps.
- **Unit (word index calc):** Pure function `findWordIndex(time, timings)` tested with edge cases (before start, after end, exact boundary, gap between words).
- **Manual:** Play `taruna-jwara` end-to-end with real audio. Verify highlight stays in sync. Test pause/skip during line mode and full mode.

## Migration Plan

1. Create `/public/data/taruna-jwara.json` with current shloka text + audio paths + hand-authored timings.
2. Add `src/lib/shloka.types.ts` and `src/lib/loadShloka.ts`.
3. Build `src/app/shloka/[id]/hooks/useShlokaPlayer.ts` with state machine + RAF sync.
4. Refactor `ShlokaDesc.jsx` to consume the hook. Preserve all existing JSX structure; only change: data source (prop instead of inline const), audio controls now delegate to hook, Sanskrit lines now render as word spans.
5. Update `src/app/shloka/[id]/page.tsx` to load JSON and pass to `ShlokaDesc`.
6. Delete `src/app/shloka/[id]/ShlokaPlayerr.jsx` (duplicate, unused).
7. Manual QA pass.

## Open Items (Decide During Implementation)

- Exact highlight color — match existing palette in `globals.css`.
- Whether to add a subtle fade on word transition (animation polish, optional).
- Whether `ShlokaList.jsx` should also be updated to read from `/public/data/` index file (out of scope for this spec; track separately if needed).
