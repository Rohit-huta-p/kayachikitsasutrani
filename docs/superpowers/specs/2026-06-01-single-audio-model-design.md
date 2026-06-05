# Single-Audio Shloka Model

**Status:** Draft
**Date:** 2026-06-01
**Scope:** Simplify the shloka data model from a dual-audio system (per-line audio files + full audio file, each with their own word timings) down to a single full-audio file with all word timings grouped into lines via drag-into-bucket UI. Add a backward-compat code path so existing shlokas keep playing without changes.

## Goal

After this ships:

1. The data model treats the **full audio file as the single source of truth**. Per-line audio uploads are no longer required for new shlokas.
2. Admin marks ALL word regions on the single full-audio waveform. Below the waveform, admin sees a pool of "Unassigned" regions + one bucket per line. Admin drags regions from the pool into the correct line bucket. Buckets show the line's sanskrit text + the ordered list of assigned regions.
3. The player uses **seek-based playback**: for "Line K rep R", it sets `audio.currentTime = lines[K].fullTimings[0].start`, plays, and pauses when `currentTime >= lines[K].fullTimings[last].end`. No more switching between audio files.
4. Existing shlokas with `audio.lines[]` keep working via the **legacy code path** (src-swap playback) — no data wipe, no admin re-entry needed.
5. The shloka detail page's display (fullText + global word index highlight) works unchanged for both old and new shlokas.

## Non-Goals

- No automatic backfill of existing shlokas to the new model.
- No drop of the `audio.lines` field — kept optional for backward compat.
- No UI to toggle between models in admin — auto-detected from the shape of the loaded shloka.
- No multi-track audio (e.g., separate male/female recordings) — out of scope.
- No automatic word-timing detection from audio — admin still marks regions manually.

## Constraints

- Existing stack: Mongoose 8 + Express 4 + zod (backend); Next.js 15 + React 19 + Tailwind 4 + WaveSurfer.js + lucide-react (frontend).
- WaveSurfer.js v7 is the waveform/region library — already in use for `<Waveform />` and `<FullAudioEditor />`.
- The existing `useShlokaPlayer` hook is a state machine driven by `useReducer` (~300 lines). Adding the new seek-based branch requires careful state handling to avoid race conditions on rapid line switches.
- Existing shlokas have `audio.lines[]` populated + `lines[].words` (line-audio timings) + `lines[].fullTimings` (full-audio timings). All three stay readable.

## Decisions

| Topic | Choice |
|---|---|
| Backend schema | `audio.lines` becomes optional. `lines[].words` becomes optional. `lines[].fullTimings` stays required. |
| Existing data | Untouched. Legacy code path handles them. |
| Region-to-line assignment UI | Drag regions from "Unassigned" pool into per-line bucket cards. |
| Player code path detection | Runtime check: `shloka.audio.lines && shloka.audio.lines.length > 0` → legacy src-swap. Otherwise → seek-based on full audio. |
| Line count | Admin sets total number of line buckets manually (Add Line / Remove Line buttons). |
| Region order within bucket | By ascending `start` time on the full audio (auto-sorted). |
| Unassigned regions on save | Reject save if any regions are unassigned (must all be in a bucket OR explicitly deleted). |
| Backfill | None. Legacy shlokas stay as legacy. |
| Test coverage | Backend: 2 new tests (single-audio shloka POST + GET). Frontend: build + manual QA. |

## Data Model

### `Shloka` schema (changes only)

```ts
{
  audio: {
    full: { type: assetSchema, required: true },
    lines: { type: [assetSchema], required: false, default: undefined },  // was required
  },
  lines: [{
    sanskrit: { type: String, required: true, ... },
    words: { type: [wordTimingSchema], required: false, default: undefined },  // was required
    fullTimings: { type: [wordTimingSchema], required: true, default: [] },  // unchanged
  }],
}
```

Backward compat: existing docs that have `audio.lines` populated still validate. New docs can omit `audio.lines` entirely.

### `PublicShloka` (no shape change, just optional propagation)

The shape already supports optional `audio.lines?` — just ensure the mapper handles `undefined`:

```ts
audio: {
  full: mapAsset(doc.audio.full),
  lines: doc.audio.lines ? doc.audio.lines.map(mapAsset) : [],
},
```

### Frontend types

`PublicShloka.audio.lines: ShlokaAsset[]` stays — empty array `[]` signals "new model". `ShlokaLine.words` becomes optional.

## Player hook

In `useShlokaPlayer.ts`:

Add a derived `playbackMode` from the shloka shape:

```ts
const isLegacy = (shloka.audio.lines?.length ?? 0) > 0;
```

If `isLegacy`: keep the existing reducer + src-swap logic unchanged.

If NOT legacy: new branch:
- `currentSrc` is always `shloka.audio.full.url`.
- For "Play line K rep R":
  - Set `audio.currentTime = lines[K].fullTimings[0].start`
  - Call `audio.play()`
  - In `onTimeUpdate`: if `audio.currentTime >= lines[K].fullTimings[lastWord].end`, pause and either repeat rep, advance line, or transition to PLAYING_FULL.
- For "Play full rep R":
  - Set `audio.currentTime = 0`
  - Call `audio.play()`
  - In `onEnded`: increment full rep or transition to DONE.
- Pause/resume preserves the current absolute time.

Word-highlight tracking for the new branch:
- `currentWordIndex` is computed from `audio.currentTime` by binary-searching within `lines[currentLine].fullTimings` for the active word.

The branch selection happens once at hook mount; if `isLegacy` changes (shouldn't), state is reset.

## Admin form

### New component: `<RegionBucketEditor />`

Replaces the current `<TimingEditor />` per-line stack on new-model shlokas.

Layout (vertical):
1. Single full-audio `<Waveform />` (reuse existing component). Admin marks regions by drag.
2. Below the waveform, three rows:
   - "Lines" header with "+ Add line" / "Remove last line" controls (manages bucket count).
   - Pool of "Unassigned regions" — horizontally-scrolling list of region cards (each showing Sanskrit fragment auto-derived from word index OR a "?" placeholder, plus start/end time).
   - Per-line buckets, stacked vertically. Each bucket: header "Line N" + line.sanskrit text (editable inline) + drop zone for region cards + ordered list of currently-assigned regions.

Interactions:
- Drag region card from Unassigned pool → drop into line bucket. Card moves into that bucket and re-renders in start-time order.
- Drag region card from a bucket → back into Unassigned OR into another bucket. Bucket counts update.
- "Add line" appends a new empty bucket. "Remove last line" removes the last bucket (its regions return to Unassigned).
- Save validation: rejected if any regions remain Unassigned. Inline error message.

Data flow into `submit()`:
- Build `lines[i].fullTimings` from the regions assigned to bucket i, sorted by `start`.
- `lines[i].words` is unset (or left empty).
- `audio.lines` is unset entirely.
- `audio.full` is the uploaded full audio file (single upload).

### Hide legacy UI on new shlokas

For a brand-new shloka (no `initial` prop):
- Show single audio uploader (only "Full audio")
- Show `<RegionBucketEditor />` instead of `<TimingEditor />` stack

For an existing shloka (with `audio.lines` populated):
- Show the old per-line audio uploads + per-line `<TimingEditor />` stack (unchanged)
- Reason: admin already has data structured the old way. Forcing a re-edit risks data loss.

Detection: `initial?.audio.lines?.length > 0`.

## Frontend display

`ShlokaDesc.jsx` unchanged. It already computes `globalWordIndex` by summing `lines[i].words.length`. For new-model shlokas, `lines[i].words` may be undefined, so the sum needs to fall back to `lines[i].fullTimings.length`:

```jsx
g += shloka.lines[i]?.words?.length ?? shloka.lines[i]?.fullTimings?.length ?? 0;
```

This single-line change handles both code paths.

## Files

### Backend
**Modify:**
- `src/models/Shloka.ts` — make `audio.lines` and `lines[].words` optional
- `src/lib/publicShloka.ts` — handle undefined `audio.lines`
- `src/routes/admin/shlokas.ts` — make `audio.lines` and `lines[].words` optional in zod
- `tests/adminShlokas.integration.test.ts` — add 2 new tests (single-audio create + read)

### Frontend
**Modify:**
- `src/lib/auth/types.ts` — `lines[].words` becomes optional
- `src/app/admin/shlokas/components/ShlokaForm.tsx` — branch on legacy vs new shloka shape
- `src/app/(student)/shloka/[slug]/hooks/useShlokaPlayer.ts` — add seek-based branch
- `src/app/(student)/shloka/[slug]/ShlokaDesc.jsx` — fallback in globalWordIndex computation

**Create:**
- `src/app/admin/shlokas/components/timing-editor/RegionBucketEditor.tsx` — main new admin UI
- `src/app/admin/shlokas/components/timing-editor/LineBucket.tsx` — single line drop zone
- `src/app/admin/shlokas/components/timing-editor/RegionCard.tsx` — draggable region card
- `src/app/admin/shlokas/components/timing-editor/useRegionAssignment.ts` — hook managing region → bucket map

## Error Handling

| Scenario | UX |
|---|---|
| Admin saves with unassigned regions | Inline error: "N region(s) are not assigned to a line. Assign them or delete them." |
| Admin loads a legacy shloka | Old UI renders; new UI hidden. No prompt to migrate. |
| Player hits a line with `fullTimings` length 0 on new-model shloka | Skip that line entirely (advance to next line). Log a console warning. |
| Browser drag-and-drop unsupported (rare) | Fallback to a "Move to:" dropdown on each region card. |
| Two regions assigned to same line have overlapping times | Backend rejects same as today (existing `validateTimings` already checks). |

## Testing

### Backend (automated)
- POST `/api/admin/shlokas` with single-audio body (no `audio.lines`, all `lines[].fullTimings` only) → 201, response includes the data
- GET `/api/shlokas/:slug` for a single-audio shloka → returns shape with empty `audio.lines: []`
- Existing tests must continue to pass (legacy data unchanged)

### Frontend (manual)
- Create new shloka in admin → see only "Full audio" upload + `<RegionBucketEditor />`
- Upload full audio → mark 6 regions across the timeline → drag 3 into Line 1 bucket + 3 into Line 2 bucket
- Save → publish → load shloka detail → tap Play → audio plays from line 1 first word, pauses at line 1 last word's end, repeats 3x, advances to line 2, etc.
- Per-word highlight walks through fullText as expected
- Open an existing legacy shloka in admin → see old per-line audio + per-line TimingEditor stack (unchanged)
- Play that legacy shloka → existing src-swap playback works (unchanged)
- Speed control still works on both code paths

## Open Items (deferred)

- Migration script to convert legacy shlokas to single-audio model (deferred until admins request it)
- Multi-track audio (separate male/female recordings)
- Visual marker on waveform showing line boundaries (after assignment)
- Auto-detect line boundaries from silence detection
- Undo/redo within RegionBucketEditor (the existing `useHistory` hook can be adapted)
