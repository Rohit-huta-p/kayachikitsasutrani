# Admin UI + Frontend Cutover

**Status:** Draft
**Date:** 2026-05-24
**Scope:** Sub-project 3. Frontend admin pages for shloka management + students list, role-based redirect, route guards, and cutover of student-facing pages from `/public/data/*.json` to the API. Two small backend additions (admin students endpoints).
**Repos:** `kayachikitsasutrani/` (Next.js frontend) primary; small additions to `shloka-backend/`.

## Goal

After this sub-project ships:

1. Admin can log in, get redirected to `/admin/shlokas`, see all shlokas (drafts + published), create/edit/delete shlokas with audio + image uploads, and view a list of students.
2. Students can log in, get redirected to `/dashboard`, see published shlokas from the API, and play any of them.
3. Anonymous visitors hitting any protected page get redirected to `/login`. Logged-in users hitting `/login` or `/signup` get redirected to their role's home.
4. The student dashboard and shloka detail page no longer read from `/public/data/*.json` — they fetch from `/api/shlokas` and `/api/shlokas/:slug`.
5. Visual style matches the existing frontend: same Navbar, same Footer, same beige theme, same component primitives.

## Non-Goals

- Visual waveform editor for word timings (sub-project 4). Admin enters timings as JSON in textareas.
- Bulk import / CSV.
- Student suspension, role promotion, or password reset via UI.
- Admin profile page or password change.
- Analytics dashboard with charts (deferred).
- Server-side search — search is client-side filter over current page only.
- Real-time updates (no SSE / websockets).
- Frontend unit/component tests — no test infra exists; backend additions still get integration tests.
- Mobile-first polish of admin pages — they should work on desktop; mobile is acceptable but not optimized.

## Constraints

- Existing frontend stack only (Next.js 15, React 19, Tailwind 4, TypeScript). No new UI libraries.
- Reuse existing components: `Button`, `Input`, `Custom_Link`, `Select`, `SearchComponent`.
- Reuse Navbar + Footer wrapping (no admin sidebar; no separate admin layout chrome).
- Stay on the existing `AuthContext`; do not introduce SWR / React Query / Redux.
- Backend already exposes shloka CRUD + uploads endpoints from sub-project 2.

## Decisions

| Topic | Choice |
|---|---|
| Routing strategy | Role-based redirect after login: admin → `/admin/shlokas`, student → `/dashboard` |
| Admin chrome | Reuse Navbar + Footer; no sidebar |
| Auth guards | Per-section client-side layouts (`AdminGuard`, `AuthGuard`) |
| Student-facing cutover | Yes — `/dashboard` and `/shloka/[slug]` fetch from API |
| Shloka route param | Renamed from `[id]` to `[slug]` (matches API + human-readable URLs) |
| Slug edit | Disabled on edit form (rename is a future "Rename" action) |
| Word timings entry | JSON textarea per line (`words` + `fullTimings` arrays) |
| Search | Client-side filter on current page only |
| Pagination | Cursor-based "Load more" button (matches backend) |
| Per-line audio | Each line has its own audio upload field; full audio is separate |
| Delete confirmation | Inline confirm modal (text input echo not required) |
| Backend additions | `GET /api/admin/students`, `GET /api/admin/students/:id` |

## Architecture

### Frontend file structure

```
kayachikitsasutrani/src/
├── app/
│   ├── layout.tsx                           (existing, no change)
│   ├── home/                                (existing, public)
│   ├── login/                               (existing) — add post-login redirect by role
│   ├── signup/                              (existing) — add post-signup redirect to /dashboard
│   ├── dashboard/
│   │   ├── layout.tsx                       NEW — AuthGuard wrapper
│   │   ├── page.tsx                         (existing)
│   │   ├── Dashboard.jsx                    MODIFY — fetch /api/shlokas
│   │   └── components/
│   │       ├── ShlokaList.jsx               MODIFY — accept shlokas prop instead of hardcoded
│   │       └── ShlokaCard.jsx               (existing) — href becomes /shloka/{slug}
│   ├── shloka/
│   │   ├── [slug]/                          NEW (replaces [id])
│   │   │   ├── layout.tsx                   NEW — AuthGuard
│   │   │   ├── page.tsx                     MODIFY — loadShloka(slug) via api.shlokas.get
│   │   │   ├── ShlokaDesc.jsx               (existing, unchanged)
│   │   │   ├── ShlokaDisplay.jsx            (existing, unchanged)
│   │   │   └── hooks/                       (existing, unchanged)
│   │   └── [id]/                            DELETED
│   └── admin/
│       ├── layout.tsx                       NEW — AdminGuard wrapper
│       ├── page.tsx                         NEW — redirects to /admin/shlokas
│       ├── shlokas/
│       │   ├── page.tsx                     NEW
│       │   ├── ShlokaListPage.tsx           NEW (the actual UI)
│       │   ├── new/
│       │   │   ├── page.tsx                 NEW
│       │   │   └── NewShlokaPage.tsx        NEW
│       │   ├── [id]/
│       │   │   └── edit/
│       │   │       ├── page.tsx             NEW
│       │   │       └── EditShlokaPage.tsx   NEW
│       │   └── components/
│       │       ├── ShlokaForm.tsx           NEW (shared by new/edit)
│       │       ├── AudioUploadField.tsx     NEW
│       │       ├── ImageUploadField.tsx     NEW
│       │       ├── LineEditor.tsx           NEW
│       │       └── ConfirmDeleteModal.tsx   NEW
│       └── students/
│           ├── page.tsx                     NEW
│           ├── StudentListPage.tsx          NEW
│           └── [id]/
│               ├── page.tsx                 NEW
│               └── StudentDetailPage.tsx    NEW
├── components/
│   └── Navbar.tsx                           MODIFY — show "Admin" link when role=admin
└── lib/
    ├── api.ts                               MODIFY — add shloka + admin + upload methods
    └── auth/
        ├── AuthGuard.tsx                    NEW — any-role gate
        ├── AdminGuard.tsx                   NEW — admin-only gate
        └── types.ts                         MODIFY — extend with Shloka types
```

### Backend additions (small)

```
shloka-backend/src/
├── routes/admin/
│   └── students.ts                          NEW — GET /, GET /:id
└── server.ts                                MODIFY — mount /api/admin/students

shloka-backend/tests/
└── adminStudents.integration.test.ts        NEW — 6 tests
```

## Route Guards

### `AuthGuard.tsx` (any role)

Client component used in `dashboard/layout.tsx` and `shloka/[slug]/layout.tsx`:

```tsx
"use client";
const { state } = useAuth();
const router = useRouter();
useEffect(() => {
  if (state.status === "anon") router.replace("/login");
}, [state.status]);
if (state.status === "loading") return <LoadingScreen />;
if (state.status === "anon") return null;
return <>{children}</>;
```

### `AdminGuard.tsx` (admin only)

Used in `admin/layout.tsx`:

```tsx
const { state } = useAuth();
const router = useRouter();
useEffect(() => {
  if (state.status === "anon") router.replace("/login");
  else if (state.status === "authed" && state.user.role !== "admin") router.replace("/dashboard");
}, [state.status]);
// loading or wrong role → loading screen; admin → children
```

### Post-login / post-signup redirects

`Login.tsx` after successful login:
```ts
const dest = user.role === "admin" ? "/admin/shlokas" : "/dashboard";
router.push(dest);
```

`Signup.tsx` after successful signup: always `/dashboard` (only students sign up).

`/login` and `/signup` pages also check current auth state on mount; if already authed, redirect immediately (so an admin who navigates back to /login gets bounced to /admin/shlokas).

## API Client Extension

Extend `src/lib/api.ts`. New methods:

```ts
export const api = {
  ...existing,
  shlokas: {
    list: (params?: { limit?: number; cursor?: string }) =>
      request<{ items: PublicShloka[]; nextCursor?: string }>(`/api/shlokas${qs(params)}`),
    get: (slug: string) =>
      request<PublicShloka>(`/api/shlokas/${encodeURIComponent(slug)}`),
  },
  admin: {
    shlokas: {
      list: (params?: { status?: 'draft'|'published'|'all'; limit?: number; cursor?: string }) =>
        request<{ items: PublicShloka[]; nextCursor?: string }>(`/api/admin/shlokas${qs(params)}`),
      get: (id: string) =>
        request<PublicShloka>(`/api/admin/shlokas/${id}`),
      create: (body: ShlokaInput) =>
        request<PublicShloka>(`/api/admin/shlokas`, { method: 'POST', body: JSON.stringify(body) }),
      update: (id: string, body: Partial<ShlokaInput>) =>
        request<PublicShloka>(`/api/admin/shlokas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      remove: (id: string) =>
        request<{ ok: true }>(`/api/admin/shlokas/${id}`, { method: 'DELETE' }),
    },
    uploads: {
      audio: (file: File) => uploadFile<{ url: string; publicId: string; duration?: number }>(`/api/admin/uploads/audio`, file),
      image: (file: File) => uploadFile<{ url: string; publicId: string; width: number; height: number }>(`/api/admin/uploads/image`, file),
    },
    students: {
      list: (params?: { limit?: number; cursor?: string }) =>
        request<{ items: PublicUser[]; nextCursor?: string }>(`/api/admin/students${qs(params)}`),
      get: (id: string) =>
        request<{ user: PublicUser }>(`/api/admin/students/${id}`),
    },
  },
};
```

Helper `uploadFile` posts FormData (no `Content-Type` header — browser sets boundary).

Helper `qs(obj)` converts to URL query string, skipping undefined values.

`ShlokaInput` is the create/update body type (mirrors backend zod schema).

## Shloka Form Component

`ShlokaForm.tsx` — single component used by both create and edit flows.

Props:
```ts
{
  initialValues?: ShlokaInput;  // undefined → create mode
  shlokaId?: string;            // if editing, used for update + delete
  onSubmitted: (shloka: PublicShloka) => void;
}
```

State shape (component-local):
```ts
{
  slug: string;
  title: string;
  meaning: string;
  translation: string;
  status: 'draft' | 'published';
  image?: { url: string; publicId: string };
  audioFull?: { url: string; publicId: string };
  lines: Array<{
    sanskrit: string;
    transliteration: string;
    audio?: { url: string; publicId: string };
    wordsJson: string;        // raw textarea content
    fullTimingsJson: string;  // raw textarea content
  }>;
  submitting: boolean;
  error: string | null;
}
```

On submit:
1. Parse each line's `wordsJson` and `fullTimingsJson`. If any fails to parse → show error inline.
2. Validate: each line has audio uploaded; full audio uploaded; image optional.
3. Build the request body matching `ShlokaInput`.
4. Call `api.admin.shlokas.create` or `update`.
5. On success: call `onSubmitted` (which navigates to the list).
6. On error: show the message from `err.message`; if `err.code === 'INVALID_TIMINGS'`, also include the field hint.

Slug field is shown but `disabled` in edit mode.

"Save Draft" and "Publish" buttons set `status` then submit. A single hidden submit happens; the buttons just choose status.

### `AudioUploadField` / `ImageUploadField`

```tsx
<input type="file" accept="audio/mpeg,audio/wav" onChange={onFile} />
{uploading && <Spinner />}
{value && <audio controls src={value.url} />}  // or <img> for image
{value && <button onClick={onClear}>Remove</button>}
```

`onFile` calls `api.admin.uploads.audio(file)` and stores the result. Errors → inline message ("Audio failed to upload: <reason>"). No progress bar in v1 — spinner only.

### `LineEditor`

Renders the per-line block. Includes:
- Sanskrit input (Devanagari)
- Transliteration input
- AudioUploadField (per-line MP3)
- Words JSON textarea (with placeholder showing format)
- FullTimings JSON textarea
- "Remove line" button

Parent renders a list of these + "+ Add line" button.

### `ConfirmDeleteModal`

Fixed overlay (`bg-black/40`) with centered card. "Cancel" + "Delete" buttons. On Delete: calls `api.admin.shlokas.remove(id)` then closes modal + redirects.

## Admin Shloka List

Page route: `/admin/shlokas`.

Layout:
- Page heading: "Shlokas" + "+ Add Shloka" button (top-right)
- Status filter row: tabs `All` / `Draft` / `Published`
- Search input: client-side filter on title + slug (over current page)
- Table:
  | Title | Slug | Status | Created | Actions |
  Each row: status pill (gray for draft, green for published), `Edit` link, `Delete` button (opens confirm modal).
- "Load more" button at bottom when `nextCursor` exists.

On mount: `api.admin.shlokas.list({ status: currentFilter })`. On status change: refetch. On delete: refetch.

## Admin Students List + Detail

`/admin/students`:
- Table: Name | Email | Role | Joined | Last login
- Click row → `/admin/students/:id`
- Search by name or email (client-side)
- Load more pagination

`/admin/students/:id`:
- Card with profile fields: name, email, role, age, gender, university, course, createdAt, lastLoginAt
- No actions (read-only). "Back to students" link.

## Student-facing Cutover

### `dashboard/Dashboard.jsx`

Refactor to fetch from API:

```jsx
const [shlokas, setShlokas] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  api.shlokas.list().then(({ items }) => {
    setShlokas(items);
  }).catch((err) => setError(err.message))
    .finally(() => setLoading(false));
}, []);
```

Render: loading state → spinner; error → red banner; otherwise pass items to existing `ShlokaList` component.

### `ShlokaList.jsx`

Becomes a pure presentational component:

```jsx
const ShlokaList = ({ shlokas }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {shlokas.map((s) => <ShlokaCard key={s.id} shloka={s} />)}
  </div>
);
```

The hardcoded internal `useState([{...}])` goes away.

### `ShlokaCard.jsx`

`href` becomes `/shloka/${shloka.slug}`. Adjust display fields to PublicShloka shape (use `title`, `meaning`, etc.).

### Shloka detail page

Rename directory `src/app/shloka/[id]` → `src/app/shloka/[slug]`. Files inside stay the same except `page.tsx` which now reads the `slug` route param and calls `api.shlokas.get(slug)` instead of `loadShloka(id)` (from `/data/*.json`).

`loadShloka.ts` from sub-project 1 can be deleted now that we use the API. `loadShloka.test.ts` deleted with it.

## Backend Additions

### `src/routes/admin/students.ts` (new)

```ts
adminStudentsRouter.use(requireAuth, requireRole('admin'));

GET /
  query: { limit?: 1..50 default 20, cursor?: string }
  returns: { items: PublicUser[], nextCursor? }
  filter: role = 'student' (admins excluded from this list)
  sort: createdAt desc, _id desc

GET /:id
  returns: { user: PublicUser } or 404
```

Reuses `cursor` helper, `toPublicUser`, `requireAuth`, `requireRole`.

### `server.ts` change

```ts
import { adminStudentsRouter } from './routes/admin/students.js';
// inside buildApp:
app.use('/api/admin/students', adminStudentsRouter);
```

### Integration tests (`tests/adminStudents.integration.test.ts`)

7 tests:
1. Unauth → 401
2. Student → 403
3. Admin → lists students only (no admins in result)
4. Pagination cursor works
5. GET by id (existing student) → 200
6. GET by id (unknown / non-existent) → 404
7. GET by id (admin user's id) → 404 (admins not in students list)

## Error Handling

| Error | UX |
|---|---|
| 401 on any call | AuthContext sets state to `anon`; router redirects to `/login` |
| 403 on admin call | "You don't have permission to do that" red banner |
| 409 SLUG_TAKEN on create | "A shloka with that slug already exists" near slug field |
| 400 INVALID_TIMINGS | "Word timings are invalid: <message>" near the affected line |
| 413 FILE_TOO_LARGE on upload | "File exceeds the size limit (20MB audio / 5MB image)" |
| 415 UNSUPPORTED_MEDIA_TYPE | "File type not allowed (allowed: mp3, wav for audio; jpg, png, webp for image)" |
| Network failure | "Network error — please try again" |
| Form validation errors (client) | inline near the offending field, red text |
| Delete failure (Cloudinary etc.) | toast / banner — but DB delete still succeeded, so navigate away anyway |

## Testing

**Backend (automated):**
- `adminStudents.integration.test.ts` — 7 tests (above)
- Re-run full suite — should be 89 tests total (82 prior + 7 new)

**Frontend (manual QA — no test infra):**
At the end of implementation, run a 12-step manual check (covered in the plan's final task):
1. Anon → /admin/shlokas → redirect to /login
2. Student → /admin/shlokas → redirect to /dashboard
3. Admin login → redirect to /admin/shlokas
4. Admin sees list (empty initially)
5. Admin creates shloka via form (uploads audio + image + JSON timings) → success → list shows it
6. Admin clicks Edit → form pre-filled → change title → save → list updated
7. Admin clicks Delete → modal → confirm → list updated, Cloudinary asset gone
8. Admin → /admin/students → sees student rows
9. Admin clicks student → detail page renders
10. Student login → /dashboard → sees published shlokas from API
11. Student clicks card → /shloka/{slug} → audio player works (existing behavior preserved)
12. Logout → navbar reverts → /admin/shlokas redirects to login

## Security Notes

- All admin guards are client-side (UX only). The backend enforces with `requireAuth + requireRole('admin')`. A direct API call from a logged-in student to an admin route still gets 403 — the client guard just keeps them out of the UI.
- File uploads validated on the backend (size + mime). The frontend's `accept=...` is UX only.
- Slug field is `disabled` on edit; backend will still accept slug changes if sent — that's fine, it just means we don't expose rename via this UI yet.
- Cookies remain httpOnly + SameSite=lax. Cross-origin behavior unchanged from sub-project 1.

## Open Items (acceptable to defer)

- Visual waveform editor — sub-project 4 candidate.
- Rename shloka slug from edit form — small follow-up.
- Server-side search on admin lists (when DB grows).
- Optimistic UI (refetch after mutation is acceptable for now).
- Admin user management (promote/demote, create another admin via UI).
- Upload progress bar (XHR-based percent indicator).
- Drag-drop file uploads.
- Toast notification system (use inline banners for now).
- Frontend test infrastructure (Vitest + RTL).
