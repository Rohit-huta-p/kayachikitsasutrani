# Per-Shloka Leaderboard

**Status:** Draft
**Date:** 2026-05-25
**Scope:** New feature — students who complete a shloka appear on a per-shloka leaderboard visible to all logged-in users. Backend model + endpoints + frontend display.

## Goal

After this ships:

1. When a student finishes the full playback sequence of a shloka (all lines × 3 reps + full audio × 3 reps), the frontend records a completion.
2. Each `/shloka/[slug]` page shows a leaderboard of students who completed it.
3. The current user sees their own rank highlighted after their first completion.
4. Leaderboard ranking combines three signals — chronological order, time-to-complete, and number of attempts — averaged into a single composite rank.

## Non-Goals

- No global cross-shloka leaderboard.
- No student profiles / "my completed shlokas" view.
- No teams or cohort filtering.
- No real-time updates (refresh fetches latest).
- No streak / daily-goal tracking.
- No image uploads for avatars — initials-on-color is good enough.
- No retake / "best of" tracking — only first completion counts. Replays don't update stats.

## Constraints

- Existing stack: Node/Express/Mongoose backend, Next.js frontend.
- Leaderboard requires auth (any role). Same `requireAuth` middleware.
- Compute ranks server-side per request — N is small (≤ thousands per shloka).
- Avatar = initials + color, no image upload.

## Decisions

| Topic | Choice |
|---|---|
| Completion trigger | Frontend POST when `useShlokaPlayer` reaches `DONE` state |
| Storage | One `ShlokaCompletion` doc per (userId, shlokaId) pair (first completion only) |
| Stats captured | `attempts` (PLAY presses leading to completion) + `elapsedSeconds` (start of completing run → DONE) |
| Repeat completions | Idempotent — backend returns existing record without updating |
| Ranking | Average of three sub-ranks: chronoRank + timeRank + attemptsRank |
| Tie-breaker | Earliest `completedAt` wins |
| Avatar | Initials in colored circle; color derived from email hash |
| Visibility | All logged-in users see all completions (per privacy decision) |

## Data Model

### `ShlokaCompletion` collection

```ts
{
  _id: ObjectId,
  userId: ObjectId,       // ref User
  shlokaId: ObjectId,     // ref Shloka
  completedAt: Date,
  attempts: number,       // ≥1
  elapsedSeconds: number, // ≥0 (duration of completing playthrough)
  createdAt: Date,
  updatedAt: Date,
}
```

Indexes:
- `{ userId: 1, shlokaId: 1 }` unique — one record per pair.
- `{ shlokaId: 1, completedAt: 1 }` — leaderboard query.

## Endpoints

### `POST /api/shlokas/:slug/complete` (auth required)

Records a completion for `req.user` on the shloka identified by `:slug`. Idempotent.

Request body:
```ts
{ attempts: number, elapsedSeconds: number }
```

Validation:
- `attempts`: integer ≥1, ≤1000
- `elapsedSeconds`: number ≥0, ≤ 24 * 60 * 60

Responses:
- 200: `{ completion: { id, userId, shlokaId, completedAt, attempts, elapsedSeconds }, alreadyCompleted: boolean }`
  - `alreadyCompleted: true` if a record existed before this call (no update done).
- 404: shloka slug not found (or shloka is draft and user isn't admin).
- 400: validation error.
- 401: unauthenticated.

### `GET /api/shlokas/:slug/leaderboard` (auth required)

Returns the ranked list for the shloka.

Query params: none in v1.

Response:
```ts
{
  total: number,
  items: Array<{
    userId: string,
    name: string,
    email: string,           // for avatar color hash; consider trimming domain
    avatarColor: string,     // hex string
    initials: string,        // 1-2 chars
    completedAt: string,     // ISO
    attempts: number,
    elapsedSeconds: number,
    chronoRank: number,
    timeRank: number,
    attemptsRank: number,
    averageRank: number,
  }>
}
```

Sorted by `averageRank` ASC; tie-break by `completedAt` ASC. No pagination in v1.

### Behavior — Draft visibility

If the shloka is a draft, the completion endpoints return 404 to non-admin users (same as the public read endpoint). Admins can complete drafts but typically wouldn't.

## Ranking algorithm

```
function rank(field, completions, direction = 'asc') {
  // Returns Map<completionId, rankNumber>
  // 1 = best (smallest if asc); ties get the same rank (dense ranking).
}

const completions = await ShlokaCompletion.find({ shlokaId })
const chrono = rank('completedAt', completions, 'asc')        // earliest first
const time   = rank('elapsedSeconds', completions, 'asc')     // fastest first
const att    = rank('attempts', completions, 'asc')           // fewest first

items = completions.map(c => ({
  ...publicFields(c, user),
  chronoRank: chrono.get(c._id),
  timeRank:   time.get(c._id),
  attemptsRank: att.get(c._id),
  averageRank: (chrono.get(c._id) + time.get(c._id) + att.get(c._id)) / 3,
}))
items.sort((a, b) => a.averageRank - b.averageRank || a.completedAt - b.completedAt)
```

Dense ranking handles ties: if two students share completedAt, both get the same chronoRank, next student gets +1.

## Avatar generation

```ts
function deriveAvatar(name: string, email: string): { initials: string; color: string } {
  const initials = (name.split(/\s+/).map(w => w[0]).slice(0, 2).join("") || "?").toUpperCase();
  // Hash email → hue 0..360, fixed sat + lightness for theme consistency
  let h = 0; for (const c of email) h = (h * 31 + c.charCodeAt(0)) % 360;
  const color = `hsl(${h}, 55%, 65%)`;
  return { initials, color };
}
```

(Backend computes and returns; frontend just renders.)

## Frontend wiring

### `useCompletionTracker` (new hook)

Lives in `src/app/shloka/[slug]/hooks/useCompletionTracker.ts`. Watches `useShlokaPlayer.state`:

- On `PLAY` (state transitions IDLE→PLAYING_LINE): if first attempt, set `startedAt = Date.now()`. Increment `attempts`.
- On `DONE` (state becomes DONE): if not already submitted in this session, POST completion with `{ attempts, elapsedSeconds: (Date.now() - startedAt) / 1000 }`. Set `submitted = true`.
- Exposes `{ submitted, alreadyCompleted, rank? }` for the UI banner.

### `Leaderboard` component (new)

`src/app/shloka/[slug]/Leaderboard.tsx`. Fetches `/api/shlokas/:slug/leaderboard` on mount + after current user submits a completion. Renders rows:

```
🏆 Leaderboard (12 completed)
┌─────────────────────────────────────────────────────────────┐
│ #1  [🟢AR]  Aakash Raj   · 2 days ago · 1 attempt · 0:42    │
│ #2  [🟠SS]  Saanvi S.    · today      · 1 attempt · 0:55    │
│ #3 ★[🟣RH]  Rohit H.     · today      · 2 attempts · 0:51   │   ← me, highlighted
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

If no completions yet: "Be the first to complete this shloka!" empty state.

### Completion banner

When `useCompletionTracker.submitted` flips true and `alreadyCompleted === false`, show:

```
🎉 You completed it! Your rank: #3 of 12
```

## Error handling

| Scenario | UX |
|---|---|
| POST completion fails (network) | Silent; record only attempts counter in-memory, retry on next DONE |
| Leaderboard fetch fails | Show "Couldn't load leaderboard" with retry button |
| Already completed | Banner says "You completed this earlier — rank #X" |
| Draft shloka | 404 on both endpoints for non-admin |

## Testing

**Backend (automated):**
- `POST /complete` happy path: creates record, returns `alreadyCompleted: false`
- Second POST: returns existing record, `alreadyCompleted: true`, no update to stats
- POST without auth: 401
- POST on draft (as student): 404
- POST on unknown slug: 404
- POST with invalid body: 400
- `GET /leaderboard` ranking: insert 3 completions with different attempts/times/dates, verify `averageRank` order
- `GET /leaderboard` on shloka with no completions: empty array
- `GET /leaderboard` without auth: 401

Target: ~9 tests. Suite grows to ~98.

**Frontend (manual):**
- Play through a shloka end-to-end → completion banner appears with rank
- Refresh page → "You completed it earlier — rank #X" banner persists
- Leaderboard shows new entry
- Multiple students complete → ranks update correctly

## Files

**Backend:**
- Create: `src/models/ShlokaCompletion.ts`
- Create: `src/lib/avatar.ts` — derive initials + color
- Create: `src/routes/completions.ts` — POST + GET
- Modify: `src/server.ts` — mount router
- Create: `tests/completions.integration.test.ts`

**Frontend:**
- Modify: `src/lib/api.ts` — add `shlokas.complete()` + `shlokas.leaderboard()`
- Modify: `src/lib/auth/types.ts` — add `Completion`, `LeaderboardRow` types
- Create: `src/app/shloka/[slug]/hooks/useCompletionTracker.ts`
- Create: `src/app/shloka/[slug]/Leaderboard.tsx`
- Modify: `src/app/shloka/[slug]/ShlokaDesc.jsx` — render leaderboard + banner

**Deleted:** none.

## Open Items (deferred)

- Pagination (top 50; expand on click)
- Realtime updates (websocket / polling)
- "My completed shlokas" profile view
- Streak / daily goal
- Image upload for avatar
- Re-completion "best of" tracking
