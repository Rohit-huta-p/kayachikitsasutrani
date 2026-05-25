# Admin Shloka Edit — UI/UX Redesign

**Status:** Draft
**Date:** 2026-05-25
**Scope:** Visual + interaction redesign of `/admin/shlokas/[id]/edit` and `/admin/shlokas/new` (both render `<ShlokaForm>`). Frontend only. No backend changes.
**Reference mockup:** `docs/superpowers/mockups/admin-shloka-edit.html`

## Goal

After this redesign ships, the admin edit/create page:

1. Uses a **two-column layout** on desktop: form metadata + collapsible line cards on the left, sticky full-audio editor + all-words sidebar on the right.
2. Surfaces a **sticky top bar** with breadcrumb, unsaved indicator, progress meter, and Save Draft / Publish buttons.
3. Each line is a **collapsible card** with a status icon (✓ done / ⚠ partial / ◯ empty), color stripe, sanskrit preview, and a chevron that rotates on expand.
4. The **right column stays visible** while the admin scrolls through lines — eliminates the back-and-forth between line cards and the full-audio editor.
5. Adds **micro-interactions and animations** that signal state changes: pulse on the unsaved dot, ring pulse on the ⚠ icon, fade-in for the "Next:" banner, smooth height transitions on collapse/expand, hover lift on cards, staggered entry, and easing on the progress meter.

The functional behavior of the form (validation, submit, drag-to-mark, sidebar word list, auto-advance to next unmarked word) is unchanged — only the layout, visual hierarchy, and motion change.

## Non-Goals

- No new functionality. Same form fields, same audio handling, same validation, same backend contract.
- No mobile-first polish — desktop is the primary target; mobile uses a stacked single-column fallback (acceptable but not optimized).
- No dark mode.
- No drag-and-drop file uploads (still click-to-upload).
- No undo/redo, no autosave (still manual Save Draft / Publish).
- No real-time collaboration.

## Constraints

- Existing stack: Next.js 15, React 19, Tailwind 4, TypeScript. No new UI libraries.
- Reuse the existing beige theme variables (`--bg-primary-base`, `--brown`, `--green`).
- Animations driven by CSS (transitions + keyframes). No animation library.
- All accessibility from before stays: form labels, keyboard reachable, ESC closes modals (existing ConfirmDeleteModal).
- File-level boundaries stay close to current. The big file (`ShlokaForm.tsx`) gets split into a layout shell + content sections to keep each file focused.

## Decisions

| Topic | Choice |
|---|---|
| Layout | Two-column on `lg` and up (left 7/12, right 5/12); stacks below `lg` |
| Top bar | Sticky, white-ish background, breadcrumb + unsaved + progress + Save buttons |
| Line cards | Collapsible accordion-style; chevron rotates; status icon left |
| Default open state | Newly added line opens; completed lines auto-collapse; multiple lines may be open simultaneously |
| Animations library | None — vanilla CSS keyframes + transitions |
| Animation timings | 200–400ms for transitions, cubic-bezier `(0.16, 1, 0.3, 1)` (ease-out) |
| Right column behavior | Sticky at `top-20` (below the sticky top bar) on `lg`+; stacks at smaller widths |
| Status icons | ✓ green / ⚠ amber pulsing / ◯ gray |
| Color palette | Beige bg + brown text/accents + green accent + line-tinted region colors (brown / blue / green / purple / orange) |
| Progress meter | Animated fill in top bar showing `<full marked> / <total words>` |
| Publish button enabled | Only when all validations pass; tooltip explains what's missing |
| Card entry | Staggered fade-in on first render (60ms increments) |

## Architecture

### File changes (frontend only)

**Modify (visual / layout only — no logic changes):**
- `src/app/admin/shlokas/components/ShlokaForm.tsx` — split markup into layout shell + section components, add sticky bar + two-column grid
- `src/app/admin/shlokas/components/LineEditor.tsx` — wrap body in collapsible `<details>`-style card; add header with status icon + color stripe + sanskrit preview
- `src/app/admin/shlokas/components/timing-editor/FullAudioEditor.tsx` — adjust styling to fit the sticky right column (no logic change)
- `src/app/admin/shlokas/components/timing-editor/WordList.tsx` — minor visual tweaks (per-row hover, selection ring)
- `src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx` and `new/NewShlokaPage.tsx` — wrap the form in a wider container, drop the existing inline heading (it moves into the sticky top bar)
- `src/app/globals.css` — append redesign CSS (animations, status icons, line-stripe utilities, soft-card utility)

**Create (new small components — keep files focused):**
- `src/app/admin/shlokas/components/EditPageShell.tsx` — sticky top bar + two-column grid wrapper
- `src/app/admin/shlokas/components/ShlokaInfoCard.tsx` — the metadata read/edit card (collapses once filled)
- `src/app/admin/shlokas/components/LineCardHeader.tsx` — collapsed-state row (status icon, color, sanskrit preview, expand chevron)

**Delete:** none.

### Component tree (after)

```
EditShlokaPage / NewShlokaPage
└─ EditPageShell                            (NEW — sticky top bar + 2-col grid)
   ├─ <StickyTopBar>                        (inline in shell)
   │    ├─ breadcrumb + title
   │    ├─ unsaved indicator (pulse dot when dirty)
   │    ├─ progress meter (animated)
   │    └─ Save Draft / Publish buttons
   └─ <Grid>
       ├─ Left column
       │   ├─ ShlokaInfoCard                (NEW — wraps existing meta inputs)
       │   └─ Lines section
       │       ├─ Header (count chip + Add button)
       │       └─ LineEditor[]              (modified to be collapsible)
       │            ├─ LineCardHeader       (NEW — always visible)
       │            └─ Collapsible body     (sanskrit, transliteration, audio, line waveform, word list)
       └─ Right column (sticky)
           └─ FullAudioEditor               (modified styling, same logic)
                ├─ progress + Next banner
                ├─ Waveform
                ├─ Color legend
                └─ All-words sidebar
```

## Layout Specification

### Sticky top bar

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Shlokas  /  Edit: <Title>            ● unsaved    Progress: ▇▇▇▇░░░░ 3/5   [Save] [Publish]│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Position: `sticky top-0 z-30`
- Height: ~52px
- Background: `bg-primary-light` with `backdrop-blur-sm` and a 1px bottom shadow
- Breadcrumb: link to `/admin/shlokas`, then `/`, then current shloka title (truncated on small widths)
- Unsaved dot: 8px circle, amber, with `pulse-dot` animation (1.8s ease-in-out infinite); only visible when local state differs from last-saved
- Progress meter: 112px wide × 6px tall track, filled bar grows via `meter-fill` transition (600ms cubic ease)
- Save Draft: secondary button (white bg, gray border)
- Publish: primary button (green bg, white text, glow shadow on hover); disabled until validation passes
- Disabled tooltip: hover shows `Mark all words on full audio first` (or whatever the gating reason is)

### Two-column grid (lg breakpoint and up)

- Container: `max-w-7xl mx-auto px-6 py-6`
- Grid: `grid grid-cols-1 lg:grid-cols-12 gap-6`
- Left column: `lg:col-span-7 space-y-4`
- Right column: `lg:col-span-5 space-y-4` with inner `sticky top-20` div

Below `lg`, stacks: left column then right column in document order.

### Shloka Info card

- Style: `soft-card` (semi-transparent white + brown border)
- Two states: **read-only summary** (shown by default once fields have values) or **inline edit form**
- Edit toggle: `[ ✎ Edit ]` link top-right; clicking flips card to editable form, same fields as today, plus a `[ Done ]` button
- Status icon: ✓ done if all required fields filled; ⚠ otherwise

### Line card

Collapsed (only the header):
- Color stripe (4px wide, full-height, line-index color)
- Chevron icon (rotates 90° when expanded)
- Status icon: ✓ done / ⚠ partial / ◯ empty
- "Line N" label + small stats (`2/2 words · full: 2/2`)
- Truncated sanskrit preview
- Remove button (top-right)

Expanded body (inside transitioning container):
- Sanskrit input + Transliteration input in a 2-col grid
- Line audio upload (one-line)
- Line waveform with WaveSurfer + zoom controls (existing)
- Per-line Word list (existing `WordList`)

Border + bg color of the card reflects status:
- ✓ done → `border-green-light bg-white/60`
- ⚠ partial → `border-amber-300 bg-white/60`
- ◯ empty → `border-gray-200 bg-white/40`

### FullAudioEditor (right column, sticky)

- Status row: `Full shloka audio — mark each word`, plus `<marked> / <total> marked` counter (animated when changes)
- "Next:" banner: amber bg, fades in on selection change
- Waveform: same WaveSurfer, slightly taller (100px), zoom controls inline
- Color legend below waveform
- All-words sidebar: scrollable list (`max-h-96 overflow-y-auto`), color stripe per row, selectable rows with selected slide-right + tint

## Animations Catalog

All animations use CSS only. No JS animation libraries.

| Animation | Target | Duration | Easing | Trigger |
|---|---|---|---|---|
| `fade-in` | Cards on initial render | 240–320ms | cubic-bezier(0.16, 1, 0.3, 1) | mount |
| Stagger | Card children | base + 60ms × index | (above) | mount |
| `pulse-dot` | Unsaved indicator | 1.8s loop | ease-in-out infinite | local state differs from saved |
| `ring-pulse` | ⚠ status icon | 2.5s loop | infinite | line has any pending warning |
| `meter-fill` (transition) | Progress bar width | 600ms | cubic-bezier(0.16, 1, 0.3, 1) | progress changes |
| Card hover lift | `.line-card:hover` | 200ms | ease | hover |
| Chevron rotate | Card expand chevron | 240ms | cubic-bezier(0.4, 0, 0.2, 1) | `.expanded` toggle |
| Body expand/collapse | `.line-body` max-height + opacity | 360ms | cubic-bezier(0.4, 0, 0.2, 1) | `.expanded` toggle |
| Region hover scale | Waveform regions | 200ms | ease | hover |
| Word-row slide | Selected sidebar row | 160ms | ease | selection |
| Publish glow | Hover state | 200ms | ease | hover |

Reduced motion: respect `prefers-reduced-motion: reduce` and disable looping animations (`pulse-dot`, `ring-pulse`) and the stagger. Single transitions (hover lift, expand) stay but use shorter durations (~120ms).

## State / Behavior Changes

| Behavior | Before | After |
|---|---|---|
| Save/Publish location | Buttons at bottom of long form | Sticky top bar, always visible |
| Line presentation | All expanded, one after another | Collapsible cards with status |
| Auto-collapse | None | Newly completed lines auto-collapse after a 600ms delay (lets user see ✓ animation) |
| Default open | All lines open | First line open; others closed; user can open any |
| Info card | Always editable inline | Read-only summary once filled; "Edit" toggles back to form |
| Validation feedback | Single error banner at submit | Per-row inline warnings (existing) + sticky top tooltip on disabled Publish + animated row indicators |
| Unsaved indicator | None | Amber pulsing dot in top bar when state differs from last-saved |

## Accessibility

- All interactive cards use `<button>` for headers so keyboard `Enter`/`Space` toggles expansion
- Status icons get `aria-label` matching their meaning ("complete", "needs attention", "empty")
- Color is not the only signal — status icons + text labels accompany each color stripe
- `prefers-reduced-motion` honored (see Animations section)
- Sticky top bar is `aria-label="Page header"` and contains landmark elements correctly nested
- Focus rings preserved on inputs + buttons; brown outline on focus (not removed)

## Error Handling

Same as current implementation. Errors continue to bubble up via:
- Per-line word-row warnings (red border + inline message)
- Submit-time backend errors shown above the Save buttons in the sticky top bar (red text, max 2 lines)
- Upload errors inline next to the field

The redesign only changes visual presentation, not error sources or codes.

## Testing

No automated frontend tests in this codebase (matches existing pattern).

Manual QA at end of implementation:
1. Page renders on desktop with two columns; right column sticks during scroll
2. Page stacks correctly on mobile (< 1024px)
3. Each line card collapses + expands with smooth animation
4. Newly completed line auto-collapses after ~600ms
5. Unsaved dot appears when admin edits anything; disappears after Publish
6. Progress meter animates as words get marked on full audio
7. Save Draft + Publish buttons in top bar work; Publish disabled until valid
8. Tooltip on disabled Publish explains what's missing
9. `prefers-reduced-motion` removes the pulsing/looping animations
10. All existing functionality (waveform drag, word selection, full-audio assignment, image/audio upload, validation) still works identically

## Migration Notes

The redesign is a pure visual swap. No data migrations. Existing shlokas open in the new editor with their data preserved. Existing routes (`/admin/shlokas`, `/admin/shlokas/new`, `/admin/shlokas/[id]/edit`) keep the same URLs.

Backend untouched.

## Open Items (acceptable to defer)

- Real autosave on idle (currently manual save only)
- Toast notification on successful publish (currently navigates away)
- Keyboard shortcuts (Cmd+S to save, ESC to collapse all)
- Animated diff highlight when admin returns to a previously-edited shloka
- Drag-and-drop reordering of lines
- "Compare with published" view for drafts
- Dark mode
