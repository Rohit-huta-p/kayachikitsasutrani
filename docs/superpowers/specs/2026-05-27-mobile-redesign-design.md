# Mobile-First Student-Facing Redesign

**Status:** Draft
**Date:** 2026-05-27
**Scope:** Rewrite student-facing pages mobile-first (≤640 px primary target), since most users will access the app on phones. Add new pages (`/my-shlokas`, `/me`). Introduce bottom tab navigation + sticky mini-player. Admin pages unchanged.

## Goal

After this ships:

1. Every student-facing page is laid out mobile-first (375 px default; scales up to desktop via Tailwind `md:` / `lg:` variants).
2. Persistent bottom tab bar (Home / My Shlokas / Me) on authenticated student pages.
3. Sticky mini-player above the tab bar on shloka detail — every existing desktop control (skip-prev, play/pause, skip-next, hide, progress, status) preserved.
4. Two new pages: `/my-shlokas` (your completed shlokas) and `/me` (profile + stats + logout).
5. New backend endpoint `GET /api/me/completions` powering the My Shlokas page.
6. Touch targets ≥44 px. Safe-area-inset respected for iPhone notch + home indicator.

## Non-Goals

- Admin pages stay as-is. The timing editor (WaveSurfer) is desktop-only by intent.
- No PWA install / offline / push notifications.
- No dark mode.
- No edit-profile flow (the Me page exposes a placeholder button only).
- No tablet-specific layouts — `md:` breakpoint just relaxes the mobile layout for wider screens; no separate component tree.
- No streak / daily goal tracking.

## Constraints

- Existing stack: Next.js 15.3, React 19, Tailwind 4, Node/Express/Mongoose backend.
- Touch target minimum: 44 × 44 px (Apple HIG).
- Safe-area handling: `env(safe-area-inset-bottom)` padding on the tab bar.
- Existing palette stays. New accent: `#D4A574` (warm amber).
- Keep existing brown utilities (`bg-brown`, `text-brown`, `bg-cream`). Add `bg-accent`, `text-accent` (amber).
- Audio playback continues across tab navigation (don't unmount the player when user taps "My Shlokas").

## Decisions

| Topic | Choice |
|---|---|
| Scope | Student pages only |
| Approach | Mobile-first rewrite (not patch existing desktop layouts) |
| Primary nav | Bottom tab bar — 3 tabs: Home (🏠) / My Shlokas (📚) / Me (👤) |
| Visual style | Existing brown/cream + new amber accent (#D4A574) |
| Shloka player | Sticky mini-player above tab bar with full controls (skip-prev / play-pause / skip-next / hide / progress / status) |
| Avatar | Initials + HSL color (matches leaderboard pattern) |
| Tab-switch behavior | Audio keeps playing in background; tab bar shows on all authenticated student routes |
| Auth pages tab bar | Hidden (login/signup/landing don't show it) |
| Touch target | 44 × 44 px minimum |
| Breakpoint | Mobile-first base; `md:` (768 px) scales up for tablets/desktop |

## Pages

### `/` Landing (rewrite — currently empty)

Hero gradient (brown → cream) with brand mark + tagline. Three feature cards (Listen & repeat / Per-word highlight / Leaderboards). Two CTAs: "Get started" → `/signup`, "I already have an account" → `/login`.

No tab bar. If user is already authed → redirect to `/home`.

### `/login`

Centered card. Brand mark + "Welcome back" subtitle. Email + password + Forgot password link + Sign in. Footer link to `/signup`.

No tab bar.

### `/signup`

Same compact form pattern. Fields (matching the recently-shipped rename + dropdown work): Full Name, Email, Password, College Name, Course (dropdown — first option pre-selected "3rd Prof BAMS"). Submit → auto-login → `/home`.

No tab bar.

### `/dashboard` (deprecate)

The existing `/dashboard` page is a near-duplicate of `/home` (both list shlokas via `api.shlokas.list()`). Replace its content with a server-side redirect to `/home` so existing bookmarks still work. Delete `src/app/dashboard/Dashboard.jsx` and `src/app/dashboard/components/`.

### `/home` 🏠 (refactor)

Top bar: "Welcome back, {firstName}" + avatar chip.

Body:
- Stats banner: completed count / available count / progress %
- Search input (filter shlokas by title — client-side for v1)
- Shloka list (vertical rows):
  - **Completed**: green-tinted thumb + checkmark + rank badge + time-ago
  - **Incomplete**: brown-tinted thumb with shloka number + line count + community completion count

Tab bar: Home active.

### `/my-shlokas` 📚 (new)

Top bar: "My Shlokas" + avatar chip.

Body:
- Filter chips: All / Top 5 (rank ≤5) / Recent (last 7 days)
- "Your best rank" banner — highlights the shloka where the user has their best rank
- List of completed shlokas only, each row: rank · attempts · elapsed time · time-ago. Best-rank shlokas marked with a star.
- Empty state: "📚 Complete more shlokas to fill your library"

Tab bar: My active.

### `/me` 👤 (new)

Top bar: "Me" + settings gear (gear is placeholder — no settings page in v1).

Body:
- Avatar block: large initials circle (HSL color, matching leaderboard) + full name + email
- Info card: College / Course / Joined date
- Stats card: Completed / Total Attempts / Best Rank
- "Edit profile" button (disabled / placeholder — no implementation in v1)
- "Log out" button (red border)

Tab bar: Me active.

### `/shloka/[slug]` (refactor — most complex page)

Every existing desktop feature preserved.

Top bar: Back arrow + shloka title + heart icon (favorite — current visual stays, still unwired).

Body (scrolls under sticky mini-player + tab bar):
- Hero card: background gradient/image + Sanskrit title overlay + subtitle. The subtitle today is hardcoded ("Guiding the Early Healing…") — keep that fallback if `shloka.subtitle` is missing.
- **Sanskrit display card**: active line large + bold; other lines dimmed (40% opacity); current word highlighted yellow (per-word highlight via existing `ShlokaDisplay` logic). Status pill below: "Line X of N · Rep R/3".
- **Meaning & Translation card**: collapsible (`<details>` element), defaults open. Renders both `shloka.translation` and `shloka.meaning`.
- **Lines summary**: every line listed as a row. Active line uses amber border + soft-amber background; done lines dimmed; upcoming lines plain.
- **Completion banner**: shown when `useCompletionTracker.submitted` is true. Says "🎉 You completed it!" or "You completed this earlier 🎉".
- **Leaderboard**: collapsed accordion by default (tap to expand). When open, renders the existing `<Leaderboard />` component compacted for mobile.

**Sticky mini-player** (positioned above the tab bar):
- Progress bar (current rep elapsed / current rep total)
- Label row: "Line X · Rep R/3" + "0:14 / 0:24"
- 4 control buttons in a row, 44 × 44 px each:
  - ⏮ Skip previous line (`player.skipPrev`)
  - ⏸ / ▶ Play / Pause / Resume — toggles based on player state
  - ⏭ Skip next line (`player.skipNext`)
  - 🙈 Hide Sanskrit (toggles visibility of the Sanskrit display card — practice mode)

Tab bar visible underneath.

## New Backend Endpoint

### `GET /api/me/completions` (auth required)

Returns the current user's completion records across all shlokas, with per-shloka rank computed.

Response:
```ts
{
  total: number,
  items: Array<{
    shlokaId: string,
    slug: string,
    title: string,
    completedAt: string,         // ISO
    attempts: number,
    elapsedSeconds: number,
    rank: number,                // user's rank for THIS shloka
    totalCompletions: number,    // total competitors on THIS shloka
  }>
}
```

Sorted by `completedAt` DESC. No pagination in v1.

Implementation:
1. Fetch user's `ShlokaCompletion` docs.
2. For each, fetch all completions on that shloka, compute the user's rank using the same dense-rank-average algorithm as `GET /:slug/leaderboard`, find the user's index in the sorted list.
3. Return enriched rows.

Performance: small N expected (single user × small shloka catalog). No optimization needed in v1.

## Layout System

### Root layout (`src/app/layout.tsx`)

Add viewport meta + theme color:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#A67C52" />
```

### Student layout (`src/app/(student)/layout.tsx`) — NEW

Route group that wraps `/home`, `/my-shlokas`, `/me`, `/shloka/[slug]` (move existing routes into this group). Renders:

```tsx
<div className="min-h-screen flex flex-col bg-cream pb-safe">
  <TopBar /> {/* per-page configurable via children prop pattern OR each page renders its own */}
  <main className="flex-1 overflow-y-auto">{children}</main>
  <TabBar />
</div>
```

Pages render their own TopBar to keep per-page variation (back button vs avatar trailing slot).

`pb-safe` = a utility class that maps to `padding-bottom: env(safe-area-inset-bottom)` (added to globals.css).

### Tab bar component (`src/components/student/TabBar.tsx`)

```tsx
const tabs = [
  { href: "/home", icon: "🏠", label: "Home" },
  { href: "/my-shlokas", icon: "📚", label: "My" },
  { href: "/me", icon: "👤", label: "Me" },
];
```

Active state: amber text + bold + colored icon. Inactive: gray. 56 px tall + safe-area padding. Hidden on `/login`, `/signup`, `/` (use a separate auth layout, or just render conditionally based on pathname).

### TopBar component (`src/components/student/TopBar.tsx`)

Configurable via props: `{ title, showBack?, trailingSlot? }`. Used by every page in the student layout.

## Components to Create

| Component | Location | Purpose |
|---|---|---|
| `<TabBar />` | `src/components/student/TabBar.tsx` | 3-tab bottom nav |
| `<TopBar />` | `src/components/student/TopBar.tsx` | Header with back / title / trailing |
| `<ShlokaListItem />` | `src/components/student/ShlokaListItem.tsx` | Reusable row for Home + My Shlokas |
| `<MiniPlayer />` | `src/components/student/MiniPlayer.tsx` | Sticky player above tab bar (extracts skip/play/hide controls from `ShlokaDesc.jsx`) |
| `<StatsBanner />` | `src/components/student/StatsBanner.tsx` | Used on Home + Me |
| `<AvatarCircle />` | `src/components/student/AvatarCircle.tsx` | Initials + HSL color (reuse logic from backend `deriveAvatar`) |

## Components to Refactor

- **`ShlokaDesc.jsx`**: extract controls to `<MiniPlayer />`. Replace 2-column grid with single-column stack. Hero becomes mobile-first. Sanskrit display expands. Leaderboard accordion-collapsed.
- **`ShlokaDisplay.jsx`**: increase mobile font size (currently `text-2xl`, target 18-22 px on phones). Reduce padding.
- **`Leaderboard.tsx`**: tighter row padding, smaller avatars on mobile.
- **`home/home.tsx`**: rewrite list, add stats banner, add search.
- **`signup/Signup.tsx`** + **`login/Login.tsx`**: full-width inputs, no two-column layout, larger touch targets.

## Files

### Frontend
**Modify:**
- `src/app/layout.tsx` — viewport meta + theme color
- `src/app/page.tsx` — landing content
- `src/app/login/Login.tsx` — mobile-first form
- `src/app/signup/Signup.tsx` — mobile-first form
- `src/app/home/home.tsx` — mobile-first list + stats
- `src/app/dashboard/page.tsx` — replace with `redirect('/home')`
- `src/app/shloka/[slug]/ShlokaDesc.jsx` — sticky player + collapsed sections
- `src/app/shloka/[slug]/ShlokaDisplay.jsx` — bigger mobile fonts
- `src/app/shloka/[slug]/Leaderboard.tsx` — compact rows
- `src/lib/api.ts` — add `api.me.completions()`
- `src/lib/auth/types.ts` — add `MyCompletionsResponse`, `MyCompletionRow` types
- `src/app/globals.css` — `pb-safe` utility + amber accent colors + animations

**Delete:**
- `src/app/dashboard/Dashboard.jsx`
- `src/app/dashboard/components/` (whole folder)
- `src/app/dashboard/layout.tsx` (if not needed after redirect)

**Create:**
- `src/app/(student)/layout.tsx` — route group with tab bar. Move `/home`, `/my-shlokas`, `/me`, `/shloka/[slug]` under this group so the tab bar renders automatically. `/login`, `/signup`, `/` stay outside the group.
- `src/app/my-shlokas/page.tsx` + `MyShlokas.tsx`
- `src/app/me/page.tsx` + `Me.tsx`
- `src/components/student/TabBar.tsx`
- `src/components/student/TopBar.tsx`
- `src/components/student/ShlokaListItem.tsx`
- `src/components/student/MiniPlayer.tsx`
- `src/components/student/StatsBanner.tsx`
- `src/components/student/AvatarCircle.tsx`

### Backend
**Modify:**
- `src/server.ts` — mount new router

**Create:**
- `src/routes/me.ts` — `GET /api/me/completions`
- `tests/me.integration.test.ts`

## Error Handling

| Scenario | UX |
|---|---|
| `/api/me/completions` fails | Empty state with "Couldn't load — retry" button on My Shlokas |
| User unauthed lands on `/home`, `/my-shlokas`, `/me` | Redirect to `/login` (already wired in existing guards) |
| iPhone safe-area conflict | `pb-safe` on the layout wrapper + tab bar |
| User taps tab while shloka playing | Audio continues in background (don't unmount audio element). Mini-player still visible on shloka detail. On Home/My/Me the mini-player is NOT shown (would need cross-page audio state — explicitly deferred). |
| Keyboard covers form submit on signup | `scroll-into-view` on focused input |

## Testing

### Backend (automated)
- `GET /api/me/completions` happy path (multi-shloka user): returns sorted list with correct rank per shloka
- `GET /api/me/completions` empty: returns `{ total: 0, items: [] }`
- `GET /api/me/completions` unauthed: 401
- `GET /api/me/completions` rank correctness: user with 2nd-place finish on a shloka should see `rank: 2`

Target: 4 new tests. Suite grows to ~103.

### Frontend (manual)
- iPhone Safari + Android Chrome: open every page; no horizontal scroll on 375 px width
- Sticky mini-player + tab bar don't overlap content (safe-area + scroll padding)
- Tab bar respects safe-area-inset-bottom on iPhone X+
- Sanskrit per-word highlight readable on 375 px (font ≥ 18 px)
- Sticky player controls hit-area ≥44 px (test with thumb)
- Shloka detail: play → reach DONE → completion banner appears → leaderboard refreshes
- Forms: virtual keyboard doesn't cover submit button (scroll-into-view)
- My Shlokas: complete a shloka → it appears in list with correct rank
- Me: shows correct college, course, joined date, stats
- Logout from Me: redirects to `/login`
- Desktop (≥768 px): pages still usable; tab bar remains at bottom on all viewport widths. Content max-width centered at `md:` for readability.

## Open Items (deferred)

- Cross-page persistent audio (continue playing while browsing other tabs)
- Edit profile flow
- Real backend search/filter (currently client-side only)
- Settings page (gear icon on Me is placeholder)
- Streak / daily goal
- Push notifications
- PWA installable + offline shloka caching
- Dark mode
- Tablet-specific layout (split-view with sidebar)
- Favorite/heart wiring (icon exists, no backend)
- Practice mode (Hide button) wiring — current spec keeps the button + just toggles visibility of Sanskrit display card

## Mockups

Three mockup HTML files saved to `.superpowers/brainstorm/69558-1779876583/content/`:
- `nav-pattern.html` — top bar + hamburger vs bottom tab bar vs compact (chose bottom tab bar)
- `shloka-detail-mobile-v2.html` — full-featured shloka detail with sticky mini-player
- `student-pages-mobile.html` — Home + My Shlokas + Me side-by-side
- `auth-pages-mobile.html` — Landing + Login + Signup
