# Admin Panel Mobile Layouts

**Status:** Draft
**Date:** 2026-05-30
**Scope:** Add mobile-friendly layouts to admin pages so admins can check status on a phone. Lists + read-only views get full mobile UIs. Edit + new pages show a friendly "Use desktop" placeholder on mobile (waveform timing editor is impractical on a 375 px screen). New `/admin/me` profile page. Bottom tab bar (Shlokas / Students / Me) on mobile.

## Goal

After this ships:

1. `/admin/shlokas` list works on phone — compact card layout, status pill, line count, tap → goes to edit (which shows the "Use desktop" prompt on mobile).
2. `/admin/students` list works on phone — row layout with avatar + name + completion count.
3. `/admin/students/[id]` detail works on phone — stacked profile card + info card + completions list.
4. `/admin/shlokas/new` and `/admin/shlokas/[id]/edit` show a friendly "Open on desktop" card on `<md` viewports. Desktop unchanged.
5. New `/admin/me` page — admin profile, role badge, stats (count of published shlokas + total students), Edit profile placeholder, Logout. Available on both mobile and desktop.
6. New `<AdminTabBar />` renders on mobile only across all admin routes — 3 tabs: 📚 Shlokas / 👥 Students / 👤 Me.
7. Existing desktop layouts unchanged at `md+` viewport.

## Non-Goals

- No waveform editor on mobile. Editing remains desktop-only.
- No new shloka creation on mobile (same reason).
- No backend changes — all data already exposed by existing endpoints.
- No analytics dashboard for admins (deferred).
- No bulk operations (mass delete, bulk status change).
- No admin notification center.
- No search/filter on `/admin/shlokas` mobile (status filter already exists at page level — keep as is on desktop, hide on mobile if cramped).

## Constraints

- Existing stack: Next.js 15, React 19, Tailwind 4.
- Re-use student mobile primitives: `bg-accent`, `text-accent`, `bg-accent-soft`, `touch-target`, `pb-safe`. Already defined in `globals.css`.
- Re-use `<AvatarCircle />` from `src/components/student/AvatarCircle.tsx`.
- Re-use `<TopBar />` pattern (build admin variant if needed — same shape, different trailing slot).
- Admin pages are wrapped by `<AdminGuard />` in `src/app/admin/layout.tsx` — preserve that.
- Top desktop `<Navbar />` (in root layout) already renders on every page. On mobile, the bottom tab bar handles nav; the desktop Navbar is hidden via `md:` classes (or stays visible — see Decisions below).

## Decisions

| Topic | Choice |
|---|---|
| Scope | List + read-only pages only (`/admin/shlokas`, `/admin/students`, `/admin/students/[id]`, new `/admin/me`) |
| Edit / new pages on mobile | Friendly `<UseDesktopPrompt />` card with back arrow |
| Navigation | Bottom tab bar (Shlokas / Students / Me) on `<md`, root Navbar on `md+` |
| Dual layout approach | `md:hidden` wraps mobile UI, `hidden md:block` wraps desktop UI in the same page file (matches student mobile pattern) |
| Profile page | New `/admin/me` — same shape as student `/me` but with admin-relevant stats |
| Admin stats source | Reuse `api.admin.shlokas.list({status: 'published'})` for published count, `api.admin.students.list()` for student count. Both already exist. |
| Logout | Same `useAuth().logout()` as student `/me` |
| Backend | No changes |

## Components

### `<AdminTabBar />` (new)

`src/components/admin/AdminTabBar.tsx`. Mirrors `src/components/student/TabBar.tsx` exactly except for the tabs array:

```tsx
const tabs: Tab[] = [
  { href: "/admin/shlokas", icon: "📚", label: "Shlokas", matchPrefix: "/admin/shlokas" },
  { href: "/admin/students", icon: "👥", label: "Students", matchPrefix: "/admin/students" },
  { href: "/admin/me", icon: "👤", label: "Me", matchPrefix: "/admin/me" },
];
```

Active state: amber text + bold, same styling as student TabBar. Hidden on `md+` via outermost `<nav className="md:hidden ...">`.

### `<UseDesktopPrompt />` (new)

`src/components/admin/UseDesktopPrompt.tsx`. Centered card with:
- 💻 emoji
- Title: "Open on desktop"
- Body: configurable string explaining why (default: "This page needs more space than a phone can offer. Open on a desktop or tablet to continue editing.")
- "Back to {section}" button (configurable href + label)

Used on `/admin/shlokas/new` and `/admin/shlokas/[id]/edit` inside `md:hidden`.

### Layout changes — `src/app/admin/layout.tsx`

Existing:
```tsx
export default function AdminLayout({ children }) {
  return <AdminGuard>{children}</AdminGuard>;
}
```

After:
```tsx
export default function AdminLayout({ children }) {
  return (
    <AdminGuard>
      <div className="min-h-screen pb-safe-tab md:pb-0">
        {children}
        <AdminTabBar />
      </div>
    </AdminGuard>
  );
}
```

`pb-safe-tab` adds room for the fixed bottom tab bar on mobile; `md:pb-0` removes it on desktop where the tab bar is hidden.

## Pages

### `/admin/shlokas` — mobile card list

Mobile layout (inside `md:hidden`):
- Top bar: title "Shlokas" + count chip + "+ New" button (tapping → goes to /admin/shlokas/new → UseDesktopPrompt)
- Status filter chips: All / Published / Drafts (smaller than desktop version)
- Card list, one card per shloka:
  - Title (sanskrit + romanized if available)
  - Slug as monospace pill
  - Status badge (Published green / Draft gray)
  - Line count meta
  - Tap → `/admin/shlokas/{id}/edit` → UseDesktopPrompt on mobile

Desktop layout (`hidden md:block`): existing list page renders unchanged.

### `/admin/shlokas/new` — UseDesktopPrompt on mobile

Mobile (`md:hidden`): `<UseDesktopPrompt />` with back arrow → `/admin/shlokas`.
Desktop (`hidden md:block`): existing `NewShlokaPage` unchanged.

### `/admin/shlokas/[id]/edit` — UseDesktopPrompt on mobile

Mobile (`md:hidden`): `<UseDesktopPrompt />` with back arrow → `/admin/shlokas`.
Desktop (`hidden md:block`): existing `EditShlokaPage` (the heavy waveform editor) unchanged.

### `/admin/students` — mobile row list

Mobile (`md:hidden`):
- Top bar: title "Students" + count chip
- Row list, one row per student:
  - `<AvatarCircle />` (initials)
  - Name (bold)
  - Email (muted)
  - Completion count chip on the right
  - Tap → `/admin/students/{id}`

Desktop (`hidden md:block`): existing table unchanged.

### `/admin/students/[id]` — mobile stacked layout

Mobile (`md:hidden`):
- Top bar with back arrow + name
- Profile card: large `<AvatarCircle />` (size 72) + name + email + role badge
- Info card: College / Course / Joined
- Stats card: whatever the existing desktop detail page already shows for this student (typically completion count, last seen, joined date). Mobile uses the same data, just restyled into the stacked card layout.
- No new admin actions — mobile only renders the data the desktop detail page already loads.

Desktop (`hidden md:block`): existing detail page unchanged.

### `/admin/me` — new profile page (mobile + desktop)

Same shape on both viewports (centered card, `max-w-md mx-auto md:max-w-2xl` so it widens on desktop):

- Top bar: "Me" title
- Avatar block: large `<AvatarCircle />` + admin name + admin email + Role badge ("Admin")
- Stats card: `Published shlokas` count + `Drafts` count + `Total students (first 50)` count. v1 fires three parallel calls — `api.admin.shlokas.list({status: 'published', limit: 50})`, `api.admin.shlokas.list({status: 'draft', limit: 50})`, `api.admin.students.list({limit: 50})` — and renders `items.length` from each. Cursor-based pagination already exists on these endpoints; deferring an accurate `total` field until students/shlokas exceed 50.
- "Edit profile" — disabled placeholder (same as student `/me`)
- "Log out" red-border button

## Files

**Backend:** no changes.

**Frontend:**

Modify:
- `src/app/admin/layout.tsx` — add tab bar + safe-area padding
- `src/app/admin/shlokas/ShlokaListPage.tsx` — wrap existing JSX in `hidden md:block`, add mobile JSX in `md:hidden`
- `src/app/admin/shlokas/new/NewShlokaPage.tsx` — wrap existing in `hidden md:block`, add `<UseDesktopPrompt />` in `md:hidden`
- `src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx` — same pattern
- `src/app/admin/students/StudentListPage.tsx` — dual layout
- `src/app/admin/students/[id]/StudentDetailPage.tsx` — dual layout

Create:
- `src/components/admin/AdminTabBar.tsx`
- `src/components/admin/UseDesktopPrompt.tsx`
- `src/app/admin/me/page.tsx`
- `src/app/admin/me/Me.tsx`

Delete: none.

## Error handling

| Scenario | UX |
|---|---|
| API call fails on mobile list page | Same error display as desktop — single line of red text |
| User on mobile taps "+ New" or "Edit" | Goes to new/edit URL, sees UseDesktopPrompt on mobile, can tap back |
| Admin logs out from `/admin/me` | Redirects to `/login` (same as student `/me`) |
| AdminGuard kicks non-admin user | Existing redirect logic (unchanged) |

## Testing

**Backend:** none (no backend changes).

**Frontend (manual on mobile + desktop):**
- Login as admin, /admin/shlokas loads card list on mobile, table on desktop
- Tap a card → edit URL → UseDesktopPrompt on mobile, full editor on desktop
- /admin/students loads row list on mobile, table on desktop
- Tap a student → detail loads in mobile stacked layout
- /admin/me loads with correct counts of published shlokas + students
- Logout from /admin/me → /login
- Tab bar visible on `<md`, hidden on `md+`
- Resize browser to <768 px → mobile layouts kick in, no horizontal scroll
- AdminTabBar respects safe-area-inset-bottom on iPhone

## Open items (deferred)

- Mobile waveform editor (would require a touch-friendly redesign of the timing editor — out of scope)
- Mobile shloka creation
- Search / filter on mobile lists
- Bulk operations
- Admin notifications
- Real-time student activity feed
