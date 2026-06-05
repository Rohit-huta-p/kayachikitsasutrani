# Case Study + Meaning Audio + Translation Removal

**Status:** Draft
**Date:** 2026-05-31
**Scope:** Three coordinated changes — (1) remove the `translation` field from the Shloka model and all UI, (2) add an optional `caseStudy` string field with a new always-visible section on the shloka detail page, (3) add an optional `audio.meaning` audio file (URL + publicId) that can be played from a button on the Meaning section header, with a progress bar below the meaning text while playing. No DB migration — mongoose simply ignores the dropped `translation` field on existing docs.

## Goal

After this ships:

1. The `translation` field is gone from the backend schema, validators, mapper, frontend types, admin form, and shloka detail rendering.
2. Admins can enter a multi-line **Case Study** string (up to 5000 chars) in the shloka edit form. The shloka detail page renders this in a new always-visible card titled "Case Study" placed after the Meaning section. The card is hidden if `caseStudy` is empty.
3. Admins can upload a **Meaning audio** file (mp3 / m4a) via the existing `<AudioUploadField />` pattern. If present, the shloka detail page's Meaning section header shows a small play/pause button. Tapping toggles playback of the meaning audio. While playing, a progress bar + elapsed/total time appears below the meaning text. The audio plays independently of the main line/full player — neither affects the other's state.

## Non-Goals

- No DB migration to `$unset` translation from existing docs (deferred — wasted bytes are acceptable).
- No word-level timing or per-word highlighting on meaning audio (it's a single audio file, played straight through).
- No queue / playlist of meaning + main audio (deferred — they're independent).
- No edit history for the case study text beyond what `useHistory` already provides.

## Constraints

- Existing stack: Mongoose 8, Node 22, Next.js 15, React 19.
- The Cloudinary `audioUpload` middleware already supports m4a/mp3/wav (recent change). Reuse as-is.
- `<AudioUploadField />` in the frontend already wraps the upload UI — reuse for meaning audio.
- The shloka detail page (`ShlokaDesc.jsx`) is a `.jsx` file (no TS strict mode). The new meaning audio state can be plain `useRef` + `useState`.
- Admin form (`ShlokaForm.tsx`) is the central edit UI — case study + meaning audio go in there.

## Decisions

| Topic | Choice |
|---|---|
| Translation cleanup | Drop field. No backfill. Mongoose ignores stale field on existing docs. |
| Case Study UI | Always-visible card. Hidden only when `caseStudy` is empty. Placed after Meaning. |
| Case Study character limit | 5000 chars (backend zod + mongoose maxlength) |
| Meaning audio UI | Play/pause button in Meaning card header + progress bar appears below meaning text when playing. Both render only if `audio.meaning?.url` exists. |
| Independence | Meaning audio uses its own `<audio>` element + state, completely independent from the main `useShlokaPlayer` hook. Stopping/pausing the main player does NOT pause meaning audio and vice versa. |
| Backend validation | `caseStudy` is `z.string().max(5000).optional()`. `audio.meaning` is the same shape as `audio.full`: `z.object({ url, publicId }).optional()`. |
| Test coverage | Drop `translation` from existing test fixtures. Add 2 new tests: one for creating a shloka with `caseStudy` + `audio.meaning`, one for verifying the public mapper returns the new fields. |

## Data Model

### `Shloka` schema (changes only)

```ts
{
  // REMOVE:
  // translation: { type: String, ... },

  // NEW:
  caseStudy: { type: String, trim: true, maxlength: 5000 },

  audio: {
    full: { type: audioRefSchema, required: true },
    lines: { type: [audioRefSchema], required: true },
    meaning: { type: audioRefSchema },  // NEW — optional
  },
}
```

`audioRefSchema` is the existing `{ url: String, publicId: String }` subschema.

### `PublicShloka` type (frontend + backend mapper)

```ts
interface PublicShloka {
  id: string;
  slug: string;
  title: string;
  meaning: string;
  // REMOVE: translation: string;
  caseStudy?: string;
  status: 'draft' | 'published';
  audio: {
    full: AudioRef;
    lines: AudioRef[];
    meaning?: AudioRef;
  };
  // ... other fields unchanged
}
```

## Admin Edit Form

In `ShlokaForm.tsx`:
- Remove the existing "Translation" textarea + state field
- Add a new "Case Study" textarea (rows=6, maxLength=5000) bound to a new `caseStudy` state field
- Below the existing `audio.full` and per-line audio uploads, add a new section: "Meaning audio (optional)" using `<AudioUploadField label="Meaning audio" value={audioMeaning} onChange={setAudioMeaning} />`
- Update the `submit()` body builder to include `caseStudy: caseStudy.trim() || undefined` and `audio.meaning: audioMeaning ?? undefined`

## Shloka Detail Page

In `ShlokaDesc.jsx`:

### Remove
- The existing `<p className="italic mb-2">{shloka.translation}</p>` line inside the Meaning collapsible. Keep `<p>{shloka.meaning}</p>` as-is.

### Add — Meaning audio playback

- New `useRef<HTMLAudioElement>` for meaning audio, separate from the main player ref
- New `useState` for `meaningPlaying` (bool), `meaningElapsed` (number), `meaningTotal` (number)
- Hidden `<audio>` element at the bottom of the page sourced from `shloka.audio.meaning?.url`
- A play/pause button rendered in the `<summary>` row of the Meaning collapsible (only when `shloka.audio?.meaning?.url`)
- Below the meaning text inside the collapsible body: a small progress strip showing elapsed/total time + a filled bar — rendered only while playing OR if `meaningElapsed > 0`

### Add — Case Study section

After the Meaning collapsible, before the Lines summary:

```tsx
{shloka.caseStudy && (
  <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
    <div className="text-sm font-bold text-brown mb-2 flex items-center gap-2">
      <BookText size={16} />
      Case Study
    </div>
    <p className="text-xs text-brown leading-relaxed whitespace-pre-wrap">{shloka.caseStudy}</p>
  </div>
)}
```

Always visible (not in `<details>`). Hidden entirely when `caseStudy` is empty.

## Files

### Backend
**Modify:**
- `src/models/Shloka.ts`
- `src/lib/publicShloka.ts`
- `src/routes/admin/shlokas.ts` (zod schema)
- `tests/shlokas.integration.test.ts`
- `tests/completions.integration.test.ts` (only if fixtures reference `translation`)

### Frontend
**Modify:**
- `src/lib/auth/types.ts`
- `src/app/admin/shlokas/components/ShlokaForm.tsx`
- `src/app/(student)/shloka/[slug]/ShlokaDesc.jsx`

No new components needed — meaning audio reuses the existing `<AudioUploadField />`.

## Testing

### Backend (automated)
- Drop `translation` from all existing test request bodies / assertions
- Add new test: `POST /api/admin/shlokas` with `caseStudy` + `audio.meaning` → 201, response includes both fields
- Add new test: `GET /api/shlokas/:slug` for a published shloka with `caseStudy` + `audio.meaning` → both present in response

### Frontend (manual)
- Admin edit page: Translation textarea is gone, Case Study textarea is present, Meaning audio upload field is present
- Save a shloka with case study + meaning audio → publish → load shloka detail
- Shloka detail: no more "italic translation" line in Meaning section; Case Study card appears after Meaning; play button appears in Meaning header
- Tap play button → meaning audio plays, progress bar appears, time counts up. Tap pause → audio pauses, button toggles back
- Start main shloka playback → meaning audio is NOT affected (independent)
- Pause main player → meaning audio (if playing) continues independently
- Refresh page mid-meaning-audio → state resets (no persistence across reload — acceptable)

## Open Items (deferred)

- Backfill script to `$unset translation` on existing docs
- Word-level highlighting on meaning audio
- Queueing meaning audio to auto-play after main playback
- Case Study rich-text formatting (currently plain text + line breaks via `whitespace-pre-wrap`)
