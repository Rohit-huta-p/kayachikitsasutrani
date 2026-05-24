# Visual Waveform Timing Editor

**Status:** Draft
**Date:** 2026-05-24
**Scope:** Sub-project 4. Replaces the JSON textareas in the admin shloka form with a visual waveform-based word-timing editor built on WaveSurfer.js. Frontend only.
**Repo:** `kayachikitsasutrani/` (Next.js). No backend changes.

## Goal

After this sub-project ships:

1. Admin uploads line audio (and the full-shloka audio) on the create/edit shloka form.
2. Two waveforms appear inside each line block: one for the line MP3 and one for the full MP3.
3. Admin drags across the waveform to create a region marking one word's start/end. Each new region adds a row to a per-line word sidebar with a single text input for the Sanskrit word.
4. Admin marks the same words on both waveforms — line MP3 (sets `words[]`) and full MP3 (sets `fullTimings[]`). Single text input syncs the word string to both arrays.
5. On submit, the editor's state serializes to the existing backend shape (`lines[i].words` and `lines[i].fullTimings`) and posts as before. No backend changes.
6. Admin never sees or types raw JSON.

## Non-Goals

- Automatic silence detection / forced alignment.
- Zoom in/out controls on the waveform.
- Keyboard shortcuts (space to play/pause, arrow keys to nudge).
- Touch / mobile support — desktop admin only for v1.
- Visual overlay on the full waveform showing the whole line's span (separate from per-word regions).
- Bulk operations (clone words, shift all words by Δt, undo/redo).
- Backend changes (data shape stays identical).
- A JSON escape hatch / advanced mode — visual is the only entry path. If needed later, add a toggle.

## Constraints

- Use existing Next.js 15 / React 19 / TypeScript / Tailwind stack.
- One new dependency: `wavesurfer.js@^7`. Comes with a Regions plugin out of the box.
- Bundle impact lives only in `/admin/*` routes — student-facing pages stay light because the imports never reach them.
- Backend data model (sub-project 2) stays as-is: parallel `words[]` + `fullTimings[]` with matching text, sorted by start, non-overlapping. Editor enforces these on submit.

## Decisions

| Topic | Choice |
|---|---|
| Renderer | WaveSurfer.js v7 + RegionsPlugin |
| Editor placement | Inside `LineEditor`, per line, both waveforms inline |
| Adding a word | Drag across waveform to create a region |
| Editing region bounds | Drag edges (resize) or body (move) |
| Word text entry | Sidebar list row, single text input synced to both arrays |
| Ordering | Auto-sort by `lineStart` ascending after each mutation |
| Delete | ✕ on sidebar row; removes from both waveforms + arrays |
| JSON textareas | Removed entirely |
| Backwards compat | Existing shlokas load — regions pre-rendered from saved timings |
| Validation | Client-side on submit + existing backend validation as final gate |
| Tests | Manual QA only (no frontend test infra) |

## Architecture

### File layout

**Create:**

```
src/app/admin/shlokas/components/timing-editor/
├── TimingEditor.tsx          per-line wrapper (props in, callbacks out)
├── Waveform.tsx              thin WaveSurfer + RegionsPlugin wrapper
├── WordList.tsx              sidebar list of word rows
├── useTimingState.ts         hook owning WordEntry[] state + mutators
└── types.ts                  WordEntry + Region types
```

**Modify:**

- `src/app/admin/shlokas/components/LineEditor.tsx` — replace `wordsJson` and `fullTimingsJson` textareas with `<TimingEditor>`.
- `src/app/admin/shlokas/components/ShlokaForm.tsx` — change `LineDraft.wordsJson`/`fullTimingsJson` fields to `words: WordEntry[]`; on submit, derive `words[]` and `fullTimings[]` from `WordEntry[]`; remove the JSON parser path.
- `package.json` — add `wavesurfer.js` to dependencies.

**No backend changes.**

### Type contracts

```ts
// timing-editor/types.ts
export interface WordEntry {
  id: string;               // local UUID; not persisted
  text: string;
  lineStart: number;        // seconds, within line MP3
  lineEnd: number;
  fullStart: number | null; // null until admin marks it on full waveform
  fullEnd: number | null;
}

export interface Region {
  id: string;
  start: number;
  end: number;
}
```

### Hook contract

```ts
// useTimingState.ts
function useTimingState(initial: WordEntry[]): {
  words: WordEntry[];
  addFromLineRegion: (start: number, end: number) => string;       // returns new id
  updateLineRegion: (id: string, start: number, end: number) => void;
  setFullRegion: (id: string, start: number, end: number) => void;
  updateFullRegion: (id: string, start: number, end: number) => void; // same as set for now
  setText: (id: string, text: string) => void;
  remove: (id: string) => void;
};
```

Every mutation re-sorts by `lineStart` ascending and propagates the new array via `onChange`.

### Waveform component contract

```ts
// Waveform.tsx
interface WaveformProps {
  audioUrl: string;
  regions: Region[];                          // controlled
  color?: string;                             // region fill
  onRegionCreate: (start: number, end: number) => void;
  onRegionUpdate: (id: string, start: number, end: number) => void;
  onRegionClick?: (id: string) => void;
  onError?: (msg: string) => void;
  height?: number;                            // px, default 80
}
```

Internally:

1. On mount: instantiate WaveSurfer at `containerRef`, register `RegionsPlugin`, load `audioUrl`.
2. On `regions` prop change: diff against the plugin's current regions; add/remove/move to match.
3. Wire plugin events:
   - `region-created` → call `onRegionCreate(start, end)` (parent assigns id, plugin region's id is reassigned to match).
   - `region-updated` → `onRegionUpdate(id, start, end)`.
   - `region-clicked` → `onRegionClick(id)`.
4. On unmount: `wavesurfer.destroy()`.

Region id assignment: when WaveSurfer creates a region (mouseup after drag), it generates a random id. We translate that to our own `WordEntry.id` via a local map kept in the Waveform component. The parent's `addFromLineRegion` returns the canonical id, which the Waveform binds to that region object.

### Sidebar `WordList` contract

```ts
// WordList.tsx
interface WordListProps {
  words: WordEntry[];
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  highlightedId?: string;       // when set, that row gets a background tint
}
```

Each row shows:
- `#N` (1-based index after sort)
- `<input>` for text (controlled, calls `onTextChange`)
- Small `Δt` label showing `lineEnd - lineStart` (helps admin spot off-by-a-lot mistakes)
- A small ⚠ icon if `fullStart === null` or `fullEnd === null` (word missing on full waveform)
- ✕ button → `onRemove(id)`

A "+ Add word" hint is NOT shown — words appear only when admin drags a region.

### Per-line layout (inside LineEditor)

```
┌─ Line N ───────────────────────────────────────────────────────────┐
│ [Sanskrit input]    [Transliteration input]    [Remove line]      │
│ [Line audio upload field]                                           │
│                                                                     │
│ Line waveform:                                                      │
│  ┌─────────────────────────────────┐  ┌── Words ──────────────┐    │
│  │ <Waveform audioUrl={line.url} > │  │ #1 [लङ्घनं   45ms ⚠ ✕]│   │
│  │   regions = words[].lineRange   │  │ #2 [स्वेदनं 92ms     ✕]│   │
│  └─────────────────────────────────┘  │ ...                     │   │
│                                       └──────────────────────────┘  │
│ Full audio (this line's words):                                    │
│  ┌─────────────────────────────────┐                                │
│  │ <Waveform audioUrl={full.url} > │  ← full waveform repeated     │
│  │   regions = words[].fullRange   │     here only for THIS line   │
│  └─────────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

Both waveforms point at the same shloka — line waveform uses `lineAudioUrl`, full waveform uses `fullAudioUrl` (passed down from `ShlokaForm`).

### Empty / not-ready states

- No line audio uploaded: line waveform area shows a dashed-border placeholder with text "Upload line audio to start marking words".
- No full audio uploaded: full waveform area shows similar placeholder.
- No words yet: word list shows "Drag across the waveform to mark a word."

### Data flow on form submit

`ShlokaForm.submit()` converts each line's `WordEntry[]` into the backend shape:

```ts
const words = entries.map(e => ({ text: e.text, start: e.lineStart, end: e.lineEnd }));
const fullTimings = entries.map(e => ({ text: e.text, start: e.fullStart!, end: e.fullEnd! }));
```

Before that conversion, validation runs:

| Check | Error message |
|---|---|
| `entries.length === 0` | `Line N: needs at least one word` |
| any `entry.text.trim() === ''` | `Line N word #K: text is required` |
| any `entry.fullStart === null` or `entry.fullEnd === null` | `Line N word #K: not yet marked on full audio` |
| any `entry.lineStart >= entry.lineEnd` | `Line N word #K: invalid line range` |
| any `entry.fullStart >= entry.fullEnd` | `Line N word #K: invalid full range` |

Sort + non-overlap checks are already enforced by the hook (auto-sort), but the backend re-validates as a defence in depth.

## Library Integration

### Install

```bash
npm install wavesurfer.js@^7
```

Bundle size: ~50KB gzipped (WaveSurfer core + Regions plugin). Imported only by admin form code → Next.js code-splits it out of student bundles automatically.

### Imports

```ts
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
```

### Initialization snippet (inside Waveform.tsx)

```ts
const ws = WaveSurfer.create({
  container: containerRef.current!,
  waveColor: '#a8a29e',           // stone-400-ish (matches brown theme)
  progressColor: '#7c5f3c',       // a brown
  height: height ?? 80,
  cursorWidth: 1,
  cursorColor: '#000',
  url: audioUrl,
});
const regions = ws.registerPlugin(RegionsPlugin.create());

// Drag-to-create
regions.enableDragSelection({ color: 'rgba(124, 95, 60, 0.2)' });

regions.on('region-created', (region) => {
  onRegionCreate(region.start, region.end);
  // Parent will hand back an id via the regions prop next render; map it.
});
regions.on('region-updated', (region) => {
  const ourId = waveSurferIdToOurId.get(region.id);
  if (ourId) onRegionUpdate(ourId, region.start, region.end);
});
regions.on('region-clicked', (region) => {
  const ourId = waveSurferIdToOurId.get(region.id);
  if (ourId && onRegionClick) onRegionClick(ourId);
});
```

The bidirectional id mapping (`waveSurferIdToOurId` Map) lives in a ref inside `Waveform.tsx`. When a new region appears in the `regions` prop with an id WaveSurfer doesn't know about, we call `regions.addRegion({...})` and store the mapping. When a region disappears from the prop, we call `region.remove()`.

## Migration / Backwards Compat

Existing shlokas (created during sub-project 3) have `words[]` and `fullTimings[]` saved in the DB. When `EditShlokaPage` loads such a shloka, the new `LineEditor` converts each line into `WordEntry[]` via:

```ts
function toEntries(line: PublicShlokaLine): WordEntry[] {
  return line.words.map((w, k) => {
    const f = line.fullTimings[k];
    return {
      id: crypto.randomUUID(),
      text: w.text,
      lineStart: w.start,
      lineEnd: w.end,
      fullStart: f?.start ?? null,
      fullEnd: f?.end ?? null,
    };
  });
}
```

Editor immediately renders regions on both waveforms. Admin can edit visually from there.

## Error Handling

| Scenario | UX |
|---|---|
| Audio fails to decode | Inline message: "Could not load audio. Try re-uploading." Waveform area shows placeholder again. |
| Region created with zero duration (click without drag) | Ignored; no word added. |
| Region overlaps another | Allowed in editor; surfaced as error on submit (per backend rules). |
| `crypto.randomUUID` unavailable (very old browser) | Use timestamp + counter fallback. |
| User uploads new line audio after marking words | Word entries' line regions become invalid; show banner: "Audio changed — line timings may need re-marking." Don't auto-delete. |

## Testing

No automated frontend tests this sub-project (matches existing pattern). Backend is untouched, so no backend tests change.

Manual QA at the end of the implementation plan covers:
1. Drag-to-create on empty line waveform → word row appears.
2. Type word text → persists to sidebar.
3. Drag-to-create on full waveform for same word → fullStart/fullEnd populated, ⚠ disappears.
4. Drag region edge → bounds update live.
5. Click region → sidebar row highlights.
6. Click ✕ → word disappears from both waveforms + sidebar.
7. Re-order auto-applies: if admin drags line region of word #2 before word #1's start, sort reshuffles row numbers.
8. Save Draft → shloka persists with correct `words[]` and `fullTimings[]`. Reload edit page → regions render in same positions.
9. Submit with missing full marker → inline error blocks submit.
10. Backwards compat: an older shloka edits cleanly.

## Open Items (acceptable to defer)

- Zoom controls — straightforward to add later (`ws.zoom(px/sec)`).
- Keyboard shortcuts — wait until admins ask.
- Touch support — same.
- Auto-detected silence / forced alignment — would be a major sub-project.
- Visual indicator of "this line's overall span" on full waveform — color overlay outside the line's range as muted; nice-to-have polish.
- Undo / redo for the editor — would need a history stack; defer.
