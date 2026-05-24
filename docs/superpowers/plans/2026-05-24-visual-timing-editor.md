# Visual Waveform Timing Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JSON timing textareas in the admin shloka form with a WaveSurfer.js-based visual editor — per-line: two waveforms (line MP3 + full MP3) with drag-to-create regions, plus a sidebar word list synced across both arrays.

**Architecture:** Five new files under `src/app/admin/shlokas/components/timing-editor/`: a thin `Waveform` wrapper around WaveSurfer + RegionsPlugin, a `WordList` sidebar, a `useTimingState` hook that owns `WordEntry[]` and exposes mutators, a `TimingEditor` composite that stitches them together, and shared `types.ts`. `LineEditor` swaps its two JSON textareas for `<TimingEditor>`. `ShlokaForm` updates the `LineDraft` shape and the submit serialization. Frontend only — backend untouched.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4. New dependency: `wavesurfer.js@^7` (includes Regions plugin).

**Spec:** `docs/superpowers/specs/2026-05-24-visual-timing-editor-design.md`

**Working directory:** `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani/`
**Branch:** `feat/shloka-audio-highlight`

---

## File Structure

**Create:**
- `src/app/admin/shlokas/components/timing-editor/types.ts`
- `src/app/admin/shlokas/components/timing-editor/useTimingState.ts`
- `src/app/admin/shlokas/components/timing-editor/Waveform.tsx`
- `src/app/admin/shlokas/components/timing-editor/WordList.tsx`
- `src/app/admin/shlokas/components/timing-editor/TimingEditor.tsx`

**Modify:**
- `package.json` (add `wavesurfer.js`)
- `src/app/admin/shlokas/components/LineEditor.tsx` (replace JSON textareas)
- `src/app/admin/shlokas/components/ShlokaForm.tsx` (LineDraft shape + submit)

**Delete:** none.

---

## Task 1: Install WaveSurfer.js

**Files:** `package.json` (via npm)

- [ ] **Step 1: Install**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
npm install wavesurfer.js@^7
```

If you hit peer-dep conflicts, retry with `--legacy-peer-deps`.

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add wavesurfer.js dependency"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/app/admin/shlokas/components/timing-editor/types.ts`

- [ ] **Step 1: Create dir + write file**

```bash
mkdir -p src/app/admin/shlokas/components/timing-editor
```

Path: `src/app/admin/shlokas/components/timing-editor/types.ts`:

```ts
export interface WordEntry {
  /** Local UUID, never persisted. */
  id: string;
  /** Sanskrit word text (single source of truth for both arrays on submit). */
  text: string;
  /** Seconds within the line MP3 (sub-second resolution). */
  lineStart: number;
  lineEnd: number;
  /** Seconds within the full shloka MP3; null until admin marks it. */
  fullStart: number | null;
  fullEnd: number | null;
}

export interface Region {
  id: string;
  start: number;
  end: number;
}

export function makeWordId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `word-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/timing-editor/types.ts
git commit -m "feat: timing-editor shared types (WordEntry, Region, makeWordId)"
```

---

## Task 3: `useTimingState` Hook

**Files:**
- Create: `src/app/admin/shlokas/components/timing-editor/useTimingState.ts`

- [ ] **Step 1: Write the hook**

Path: `src/app/admin/shlokas/components/timing-editor/useTimingState.ts`:

```ts
"use client";

import { useCallback, useState } from "react";
import { type WordEntry, makeWordId } from "./types";

function sortByLineStart(arr: WordEntry[]): WordEntry[] {
  return [...arr].sort((a, b) => a.lineStart - b.lineStart);
}

export interface TimingStateApi {
  words: WordEntry[];
  addFromLineRegion: (start: number, end: number) => string;
  updateLineRegion: (id: string, start: number, end: number) => void;
  setFullRegion: (id: string, start: number, end: number) => void;
  setText: (id: string, text: string) => void;
  remove: (id: string) => void;
}

export function useTimingState(
  initial: WordEntry[],
  onChange?: (next: WordEntry[]) => void,
): TimingStateApi {
  const [words, setWords] = useState<WordEntry[]>(() => sortByLineStart(initial));

  const commit = useCallback(
    (next: WordEntry[]) => {
      const sorted = sortByLineStart(next);
      setWords(sorted);
      onChange?.(sorted);
    },
    [onChange],
  );

  const addFromLineRegion = useCallback(
    (start: number, end: number): string => {
      const id = makeWordId();
      commit([
        ...words,
        { id, text: "", lineStart: start, lineEnd: end, fullStart: null, fullEnd: null },
      ]);
      return id;
    },
    [commit, words],
  );

  const updateLineRegion = useCallback(
    (id: string, start: number, end: number) => {
      commit(words.map((w) => (w.id === id ? { ...w, lineStart: start, lineEnd: end } : w)));
    },
    [commit, words],
  );

  const setFullRegion = useCallback(
    (id: string, start: number, end: number) => {
      commit(words.map((w) => (w.id === id ? { ...w, fullStart: start, fullEnd: end } : w)));
    },
    [commit, words],
  );

  const setText = useCallback(
    (id: string, text: string) => {
      commit(words.map((w) => (w.id === id ? { ...w, text } : w)));
    },
    [commit, words],
  );

  const remove = useCallback(
    (id: string) => {
      commit(words.filter((w) => w.id !== id));
    },
    [commit, words],
  );

  return { words, addFromLineRegion, updateLineRegion, setFullRegion, setText, remove };
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/timing-editor/useTimingState.ts
git commit -m "feat: useTimingState hook with sorted mutations + onChange"
```

---

## Task 4: `Waveform` Component (WaveSurfer wrapper)

**Files:**
- Create: `src/app/admin/shlokas/components/timing-editor/Waveform.tsx`

- [ ] **Step 1: Write the component**

Path: `src/app/admin/shlokas/components/timing-editor/Waveform.tsx`:

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region as WsRegion } from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { Region } from "./types";

interface Props {
  audioUrl: string;
  regions: Region[];
  /** Region fill color (rgba). */
  color?: string;
  /** Region currently highlighted (sidebar selection). */
  highlightedId?: string;
  /**
   * Called when admin drags a new region. Parent returns the canonical id
   * to bind, or null to drop the region (Waveform will remove it).
   */
  onRegionCreate: (start: number, end: number) => string | null;
  /** Called when admin drags an existing region's bounds. */
  onRegionUpdate: (id: string, start: number, end: number) => void;
  /** Called when admin clicks a region (for sidebar sync). */
  onRegionClick?: (id: string) => void;
  /** Called if audio fails to load. */
  onError?: (msg: string) => void;
  /** px; default 80. */
  height?: number;
}

const DEFAULT_COLOR = "rgba(124, 95, 60, 0.25)";
const HIGHLIGHT_COLOR = "rgba(124, 95, 60, 0.5)";

const Waveform: React.FC<Props> = ({
  audioUrl,
  regions,
  color,
  highlightedId,
  onRegionCreate,
  onRegionUpdate,
  onRegionClick,
  onError,
  height = 80,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const wsIdToOurId = useRef<Map<string, string>>(new Map());
  const ourIdToWsRegion = useRef<Map<string, WsRegion>>(new Map());
  const [ready, setReady] = useState(false);

  // Init WaveSurfer once per audioUrl
  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);
    wsIdToOurId.current.clear();
    ourIdToWsRegion.current.clear();

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#a8a29e",
      progressColor: "#7c5f3c",
      cursorColor: "#000",
      cursorWidth: 1,
      height,
      url: audioUrl,
    });
    const rp = ws.registerPlugin(RegionsPlugin.create());
    rp.enableDragSelection({ color: color ?? DEFAULT_COLOR });

    wsRef.current = ws;
    regionsPluginRef.current = rp;

    const onReady = () => setReady(true);
    const onErrorEvt = (err: unknown) => {
      if (onError) onError(err instanceof Error ? err.message : String(err));
    };
    ws.on("ready", onReady);
    ws.on("error", onErrorEvt);

    rp.on("region-created", (region: WsRegion) => {
      // Skip if this region came from us (we created it programmatically — has an our-id mapping).
      if (wsIdToOurId.current.has(region.id)) return;
      const id = onRegionCreate(region.start, region.end);
      if (id === null) {
        // Parent dropped it — remove from WaveSurfer.
        region.remove();
        return;
      }
      // If the parent already has a region for this id (e.g. drag on full waveform
      // when the highlighted word already had a fullStart/fullEnd), the regions
      // sync effect would create a duplicate. Defer to the sync: remove the
      // raw region and let the next render add a fresh one bound to our id.
      if (ourIdToWsRegion.current.has(id)) {
        region.remove();
        return;
      }
      wsIdToOurId.current.set(region.id, id);
      ourIdToWsRegion.current.set(id, region);
    });
    rp.on("region-updated", (region: WsRegion) => {
      const ourId = wsIdToOurId.current.get(region.id);
      if (ourId) onRegionUpdate(ourId, region.start, region.end);
    });
    rp.on("region-clicked", (region: WsRegion, e: MouseEvent) => {
      e.stopPropagation();
      const ourId = wsIdToOurId.current.get(region.id);
      if (ourId && onRegionClick) onRegionClick(ourId);
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsPluginRef.current = null;
    };
    // We intentionally re-init when audioUrl changes — destroy + recreate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, height]);

  // Sync `regions` prop into the plugin once ready
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp || !ready) return;

    const incomingIds = new Set(regions.map((r) => r.id));

    // Remove regions that disappeared from props
    for (const [ourId, wsRegion] of ourIdToWsRegion.current.entries()) {
      if (!incomingIds.has(ourId)) {
        wsRegion.remove();
        wsIdToOurId.current.delete(wsRegion.id);
        ourIdToWsRegion.current.delete(ourId);
      }
    }

    // Add or update incoming regions
    for (const r of regions) {
      const existing = ourIdToWsRegion.current.get(r.id);
      const fill = r.id === highlightedId ? HIGHLIGHT_COLOR : (color ?? DEFAULT_COLOR);
      if (!existing) {
        const wsRegion = rp.addRegion({ start: r.start, end: r.end, color: fill, drag: true, resize: true });
        wsIdToOurId.current.set(wsRegion.id, r.id);
        ourIdToWsRegion.current.set(r.id, wsRegion);
      } else {
        if (existing.start !== r.start || existing.end !== r.end) {
          existing.setOptions({ start: r.start, end: r.end });
        }
        existing.setOptions({ color: fill });
      }
    }
  }, [regions, highlightedId, color, ready]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full" />
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => wsRef.current?.playPause()}
          disabled={!ready}
          className="px-2 py-0.5 border rounded"
        >
          ▶︎ / ⏸︎
        </button>
        <button
          type="button"
          onClick={() => wsRef.current?.stop()}
          disabled={!ready}
          className="px-2 py-0.5 border rounded"
        >
          ⏹
        </button>
        {!ready && <span className="text-gray-500">Loading audio…</span>}
      </div>
    </div>
  );
};

export default Waveform;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean. (If WaveSurfer types complain about the regions plugin import path, try `import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";` instead. The `.esm.js` path is canonical for v7 but bundlers sometimes prefer the `.js`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/timing-editor/Waveform.tsx
git commit -m "feat: Waveform component wrapping WaveSurfer + RegionsPlugin"
```

---

## Task 5: `WordList` Sidebar

**Files:**
- Create: `src/app/admin/shlokas/components/timing-editor/WordList.tsx`

- [ ] **Step 1: Write the component**

Path: `src/app/admin/shlokas/components/timing-editor/WordList.tsx`:

```tsx
"use client";

import React from "react";
import type { WordEntry } from "./types";

interface Props {
  words: WordEntry[];
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  highlightedId?: string;
  onRowClick?: (id: string) => void;
}

function formatMs(seconds: number): string {
  return `${Math.round((seconds) * 1000)} ms`;
}

const WordList: React.FC<Props> = ({ words, onTextChange, onRemove, highlightedId, onRowClick }) => {
  if (words.length === 0) {
    return (
      <p className="text-xs text-gray-500 italic">
        Drag across the waveform to mark a word.
      </p>
    );
  }

  return (
    <ol className="space-y-1 text-sm">
      {words.map((w, i) => {
        const fullMissing = w.fullStart === null || w.fullEnd === null;
        const isHighlighted = w.id === highlightedId;
        return (
          <li
            key={w.id}
            onClick={() => onRowClick?.(w.id)}
            className={
              isHighlighted
                ? "flex items-center gap-2 p-1 rounded bg-yellow-100 cursor-pointer"
                : "flex items-center gap-2 p-1 rounded hover:bg-white/50 cursor-pointer"
            }
          >
            <span className="text-xs text-gray-500 w-6 shrink-0">#{i + 1}</span>
            <input
              type="text"
              value={w.text}
              onChange={(e) => onTextChange(w.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="word"
              className="flex-1 border px-2 py-0.5 rounded text-sm"
            />
            <span className="text-xs text-gray-500 shrink-0" title="line duration">
              {formatMs(w.lineEnd - w.lineStart)}
            </span>
            {fullMissing && (
              <span title="Mark on full audio waveform" className="text-amber-600 text-sm">⚠</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(w.id);
              }}
              className="text-red-600 text-xs"
              aria-label="Remove word"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export default WordList;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/timing-editor/WordList.tsx
git commit -m "feat: WordList sidebar with text input + remove + missing-full indicator"
```

---

## Task 6: `TimingEditor` Composite

**Files:**
- Create: `src/app/admin/shlokas/components/timing-editor/TimingEditor.tsx`

- [ ] **Step 1: Write the component**

Path: `src/app/admin/shlokas/components/timing-editor/TimingEditor.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import Waveform from "./Waveform";
import WordList from "./WordList";
import { useTimingState } from "./useTimingState";
import type { WordEntry } from "./types";

interface Props {
  lineAudioUrl?: string;
  fullAudioUrl?: string;
  value: WordEntry[];
  onChange: (next: WordEntry[]) => void;
}

const TimingEditor: React.FC<Props> = ({ lineAudioUrl, fullAudioUrl, value, onChange }) => {
  const { words, addFromLineRegion, updateLineRegion, setFullRegion, setText, remove } =
    useTimingState(value, onChange);
  const [highlightedId, setHighlightedId] = useState<string | undefined>();
  const [lineError, setLineError] = useState<string | null>(null);
  const [fullError, setFullError] = useState<string | null>(null);

  const lineRegions = words.map((w) => ({ id: w.id, start: w.lineStart, end: w.lineEnd }));
  const fullRegions = words
    .filter((w) => w.fullStart !== null && w.fullEnd !== null)
    .map((w) => ({ id: w.id, start: w.fullStart as number, end: w.fullEnd as number }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-semibold">Line waveform</div>
        {lineAudioUrl ? (
          <Waveform
            audioUrl={lineAudioUrl}
            regions={lineRegions}
            highlightedId={highlightedId}
            onRegionCreate={(start, end) => addFromLineRegion(start, end)}
            onRegionUpdate={(id, start, end) => updateLineRegion(id, start, end)}
            onRegionClick={(id) => setHighlightedId(id)}
            onError={(msg) => setLineError(msg)}
          />
        ) : (
          <div className="border border-dashed border-gray-300 rounded p-6 text-center text-xs text-gray-500">
            Upload line audio to start marking words.
          </div>
        )}
        {lineError && <p className="text-xs text-red-600">Line audio: {lineError}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Full audio (this line&apos;s words)</div>
          {fullAudioUrl ? (
            <Waveform
              audioUrl={fullAudioUrl}
              regions={fullRegions}
              highlightedId={highlightedId}
              onRegionCreate={(start, end) => {
                // Full-waveform drags set the currently-highlighted word's
                // full range. If no word is highlighted, drop the drag and
                // show a tip.
                if (highlightedId) {
                  setFullRegion(highlightedId, start, end);
                  setFullError(null);
                  // Return null so Waveform removes the raw drag; the regions
                  // sync effect will render the correct region on next pass.
                  return null;
                }
                setFullError("Select a word from the list first, then drag here.");
                return null;
              }}
              onRegionUpdate={(id, start, end) => setFullRegion(id, start, end)}
              onRegionClick={(id) => setHighlightedId(id)}
              onError={(msg) => setFullError(msg)}
            />
          ) : (
            <div className="border border-dashed border-gray-300 rounded p-6 text-center text-xs text-gray-500">
              Upload full shloka audio to mark word positions in the full track.
            </div>
          )}
          {fullError && <p className="text-xs text-red-600">Full audio: {fullError}</p>}
          <p className="text-xs text-gray-500 italic">
            Tip: select a word in the list, then drag on this waveform to set its full-MP3 position.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Words ({words.length})</div>
          <WordList
            words={words}
            onTextChange={setText}
            onRemove={remove}
            highlightedId={highlightedId}
            onRowClick={(id) => setHighlightedId(id)}
          />
        </div>
      </div>
    </div>
  );
};

export default TimingEditor;
```

> **UX note:** Drags on the full waveform are routed to whichever word is currently highlighted in the sidebar. If no word is highlighted, the drag is dropped and an inline tip appears. The intended flow is: drag on the line waveform to create a word → click that word's row in the sidebar to highlight it → drag on the full waveform to position the same word in the full track.

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/timing-editor/TimingEditor.tsx
git commit -m "feat: TimingEditor composite (two waveforms + word sidebar)"
```

---

## Task 7: Refactor `LineEditor` to Use `TimingEditor`

**Files:**
- Modify: `src/app/admin/shlokas/components/LineEditor.tsx`

- [ ] **Step 1: Replace `LineEditor.tsx` fully**

Path: `src/app/admin/shlokas/components/LineEditor.tsx`:

```tsx
"use client";

import React from "react";
import AudioUploadField from "./AudioUploadField";
import TimingEditor from "./timing-editor/TimingEditor";
import type { WordEntry } from "./timing-editor/types";
import type { ShlokaAssetInput } from "@/lib/auth/types";

export interface LineDraft {
  sanskrit: string;
  transliteration: string;
  audio?: ShlokaAssetInput;
  words: WordEntry[];
}

interface Props {
  index: number;
  line: LineDraft;
  fullAudioUrl?: string;
  onChange: (next: LineDraft) => void;
  onRemove: () => void;
}

const LineEditor: React.FC<Props> = ({ index, line, fullAudioUrl, onChange, onRemove }) => {
  const update = <K extends keyof LineDraft>(key: K, val: LineDraft[K]) =>
    onChange({ ...line, [key]: val });

  return (
    <div className="border border-gray-300 rounded p-4 space-y-3 bg-white/40">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-brown">Line {index + 1}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-600 underline"
        >
          Remove line
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Sanskrit (Devanagari)</label>
        <input
          type="text"
          value={line.sanskrit}
          onChange={(e) => update("sanskrit", e.target.value)}
          className="w-full border px-2 py-1 rounded"
          placeholder="लङ्घनं स्वेदनं ..."
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Transliteration</label>
        <input
          type="text"
          value={line.transliteration}
          onChange={(e) => update("transliteration", e.target.value)}
          className="w-full border px-2 py-1 rounded"
          placeholder="laṅghanaṁ svēdanaṁ ..."
        />
      </div>

      <AudioUploadField
        label="Line audio (MP3)"
        value={line.audio}
        onChange={(audio) => update("audio", audio)}
      />

      <TimingEditor
        lineAudioUrl={line.audio?.url}
        fullAudioUrl={fullAudioUrl}
        value={line.words}
        onChange={(words) => update("words", words)}
      />
    </div>
  );
};

export default LineEditor;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: ERRORS in `ShlokaForm.tsx` because LineDraft shape changed (the form still references `wordsJson`/`fullTimingsJson`). Task 8 fixes those. Note this in your report; do not fix here.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/LineEditor.tsx
git commit -m "refactor: LineEditor uses TimingEditor instead of JSON textareas"
```

---

## Task 8: Refactor `ShlokaForm` for New `LineDraft` Shape

**Files:**
- Modify: `src/app/admin/shlokas/components/ShlokaForm.tsx`

- [ ] **Step 1: Replace `ShlokaForm.tsx` fully**

Path: `src/app/admin/shlokas/components/ShlokaForm.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import AudioUploadField from "./AudioUploadField";
import ImageUploadField from "./ImageUploadField";
import LineEditor, { type LineDraft } from "./LineEditor";
import type { WordEntry } from "./timing-editor/types";
import { makeWordId } from "./timing-editor/types";
import { api } from "@/lib/api";
import type { PublicShloka, ShlokaInput, ShlokaAssetInput } from "@/lib/auth/types";

interface Props {
  initial?: PublicShloka;
  onSaved: (s: PublicShloka) => void;
}

function toEntries(line: PublicShloka["lines"][number]): WordEntry[] {
  return line.words.map((w, k) => {
    const f = line.fullTimings[k];
    return {
      id: makeWordId(),
      text: w.text,
      lineStart: w.start,
      lineEnd: w.end,
      fullStart: f?.start ?? null,
      fullEnd: f?.end ?? null,
    };
  });
}

function toLineDraft(line: PublicShloka["lines"][number], audio?: ShlokaAssetInput): LineDraft {
  return {
    sanskrit: line.sanskrit,
    transliteration: line.transliteration,
    audio,
    words: toEntries(line),
  };
}

const emptyLine = (): LineDraft => ({
  sanskrit: "",
  transliteration: "",
  audio: undefined,
  words: [],
});

const ShlokaForm: React.FC<Props> = ({ initial, onSaved }) => {
  const isEdit = !!initial;
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [meaning, setMeaning] = useState(initial?.meaning ?? "");
  const [translation, setTranslation] = useState(initial?.translation ?? "");
  const [status, setStatus] = useState<"draft" | "published">(initial?.status ?? "draft");
  const [image, setImage] = useState<ShlokaAssetInput | undefined>(
    initial?.image ? { url: initial.image.url, publicId: initial.image.publicId ?? "" } : undefined,
  );
  const [audioFull, setAudioFull] = useState<ShlokaAssetInput | undefined>(
    initial?.audio.full
      ? { url: initial.audio.full.url, publicId: initial.audio.full.publicId ?? "" }
      : undefined,
  );
  const [lines, setLines] = useState<LineDraft[]>(
    initial
      ? initial.lines.map((l, i) =>
          toLineDraft(
            l,
            initial.audio.lines[i]
              ? {
                  url: initial.audio.lines[i].url,
                  publicId: initial.audio.lines[i].publicId ?? "",
                }
              : undefined,
          ),
        )
      : [emptyLine()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (i: number, next: LineDraft) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? next : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const submit = async (nextStatus?: "draft" | "published") => {
    setError(null);
    const finalStatus = nextStatus ?? status;
    if (!slug.trim() && !isEdit) return setError("Slug is required");
    if (!title.trim()) return setError("Title is required");
    if (!meaning.trim()) return setError("Meaning is required");
    if (!translation.trim()) return setError("Translation is required");
    if (!audioFull) return setError("Full audio is required");
    if (lines.length === 0) return setError("At least one line is required");

    const builtLines = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.sanskrit.trim()) return setError(`Line ${i + 1}: sanskrit is required`);
      if (!l.audio) return setError(`Line ${i + 1}: audio is required`);
      if (l.words.length === 0) return setError(`Line ${i + 1}: needs at least one word`);
      for (let k = 0; k < l.words.length; k++) {
        const w = l.words[k];
        if (!w.text.trim()) return setError(`Line ${i + 1} word #${k + 1}: text is required`);
        if (w.lineStart >= w.lineEnd) return setError(`Line ${i + 1} word #${k + 1}: invalid line range`);
        if (w.fullStart === null || w.fullEnd === null) {
          return setError(`Line ${i + 1} word #${k + 1}: not yet marked on full audio`);
        }
        if (w.fullStart >= w.fullEnd) return setError(`Line ${i + 1} word #${k + 1}: invalid full range`);
      }
      builtLines.push({
        sanskrit: l.sanskrit,
        transliteration: l.transliteration,
        words: l.words.map((w) => ({ text: w.text, start: w.lineStart, end: w.lineEnd })),
        fullTimings: l.words.map((w) => ({
          text: w.text,
          start: w.fullStart as number,
          end: w.fullEnd as number,
        })),
      });
    }

    const body: ShlokaInput = {
      slug,
      title,
      meaning,
      translation,
      status: finalStatus,
      audio: {
        full: audioFull,
        lines: lines.map((l) => l.audio!),
      },
      image,
      lines: builtLines,
    };

    setSubmitting(true);
    try {
      const saved =
        isEdit && initial
          ? await api.admin.shlokas.update(initial.id, body)
          : await api.admin.shlokas.create(body);
      setStatus(finalStatus);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4 max-w-3xl">
      <div className="space-y-1">
        <label className="font-semibold">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={isEdit}
          className="w-full border px-2 py-1 rounded disabled:bg-gray-100"
          placeholder="taruna-jwara"
        />
      </div>

      <div className="space-y-1">
        <label className="font-semibold">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="space-y-1">
        <label className="font-semibold">Meaning</label>
        <textarea
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          rows={3}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <div className="space-y-1">
        <label className="font-semibold">Translation</label>
        <textarea
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          rows={3}
          className="w-full border px-2 py-1 rounded"
        />
      </div>

      <ImageUploadField label="Image (optional)" value={image} onChange={setImage} />

      <AudioUploadField label="Full audio (MP3)" value={audioFull} onChange={setAudioFull} />

      <div>
        <h3 className="font-semibold text-brown mb-2">Lines</h3>
        <div className="space-y-3">
          {lines.map((l, i) => (
            <LineEditor
              key={i}
              index={i}
              line={l}
              fullAudioUrl={audioFull?.url}
              onChange={(next) => updateLine(i, next)}
              onRemove={() => removeLine(i)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-2 text-sm text-green underline"
        >
          + Add line
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void submit("draft")}
          disabled={submitting}
          className="bg-indigo-100 hover:bg-indigo-200 px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => void submit("published")}
          disabled={submitting}
          className="bg-green text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Publish"}
        </button>
      </div>
    </form>
  );
};

export default ShlokaForm;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/shlokas/components/ShlokaForm.tsx
git commit -m "refactor: ShlokaForm uses WordEntry-based LineDraft; submit serializes to backend shape"
```

---

## Task 9: Build + Lint Verification

**Files:** none (verification step)

- [ ] **Step 1: Clear .next + build**

```bash
rm -rf .next
npx tsc --noEmit
npm run lint 2>&1 | tail -30
npm run build 2>&1 | tail -25
```

Expected:
- tsc clean
- lint: only pre-existing warnings (no new errors introduced by this sub-project)
- build: succeeds, all routes including admin pages compile

If a build error mentions WaveSurfer plugin import path, switch the import in `Waveform.tsx`:
```ts
// From:
import RegionsPlugin, { type Region as WsRegion } from "wavesurfer.js/dist/plugins/regions.esm.js";
// To:
import RegionsPlugin, { type Region as WsRegion } from "wavesurfer.js/dist/plugins/regions.js";
```
Rebuild. If still failing, try `wavesurfer.js/plugins/regions`. Commit any working path.

- [ ] **Step 2: Commit if any path tweak was needed**

```bash
git add src/app/admin/shlokas/components/timing-editor/Waveform.tsx
git commit -m "fix: WaveSurfer regions plugin import path for build"
```

---

## Task 10: End-to-End Manual QA

This is a manual verification step. No code changes unless a bug surfaces. Backend + frontend running.

**Prereqs:**
- Backend running on http://localhost:4000
- Frontend running on http://localhost:3000
- Admin already seeded
- Cloudinary configured

- [ ] **Step 1: Log in as admin**

Visit http://localhost:3000/login. Enter admin credentials. Should land on /admin/shlokas.

- [ ] **Step 2: Open New Shloka form**

Click "+ Add Shloka". Form opens. Fill slug = `viz-test`, title = `Viz Test`, meaning + translation = anything.

- [ ] **Step 3: Upload image + full audio**

Upload any small image. Upload any small MP3 as full audio (e.g. from `public/audio/Taruna_Jwara_Full.mp3` in the frontend repo).

- [ ] **Step 4: Inside Line 1, upload line audio**

Upload `public/audio/Navajwara_Part_1.mp3`. Line waveform should render within a few seconds.

- [ ] **Step 5: Drag a region on the line waveform**

Click+drag a horizontal range on the line waveform. Expected: a colored region appears, a row appears in the Words sidebar with an empty text input and a ⚠ icon (full not yet marked).

- [ ] **Step 6: Type word text**

Type `लङ्घनं` (or any Sanskrit/Latin text) into the row's input. The text persists.

- [ ] **Step 7: Click the word's row to highlight, drag on full waveform**

Click the row in the Words sidebar. Drag a corresponding range on the full audio waveform. Expected: ⚠ disappears, the full waveform shows a region in the same color, click-to-highlight ties them together.

(If the editor uses the "ignored" full-waveform behavior described in Task 6, you'll see that drags on full are dropped. In that case the implementer should have switched to the "highlight selects target" behavior — verify which approach was taken.)

- [ ] **Step 8: Add a second word**

Drag again on the line waveform. Second row appears. Add text. Mark on full waveform.

- [ ] **Step 9: Resize a region**

Drag the edge of an existing region. The line duration column updates.

- [ ] **Step 10: Delete a word**

Click ✕ on a sidebar row. Region disappears from BOTH waveforms.

- [ ] **Step 11: Publish**

Click "Publish". Expected: returns to /admin/shlokas. New row visible.

- [ ] **Step 12: Re-open for edit**

Click "Edit" on the new row. Expected: form loads with the words pre-rendered as regions on both waveforms, sidebar populated. Editing still works.

- [ ] **Step 13: Visit student view**

Log out → log in as student → /dashboard → click the shloka card → audio player works → word highlight tracks the audio based on the timings you visually authored.

- [ ] **Step 14: Report findings**

If anything broke, file the bug here; the controller dispatches a fix.

---

## Verification Checklist

After all tasks:
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` no new errors
- [ ] `npm run build` succeeds
- [ ] Manual QA passes Tasks 5-13 above
