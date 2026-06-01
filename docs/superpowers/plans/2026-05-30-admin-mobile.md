# Admin Mobile Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile-friendly layouts to admin list + read-only pages, show a "Use desktop" prompt for edit/new pages, and introduce a new `/admin/me` profile page — all gated by Tailwind `md:hidden` / `hidden md:block` breakpoints so desktop is unchanged.

**Architecture:** Same dual-layout pattern as the student mobile work — each page file renders both mobile and desktop UIs side-by-side, visibility toggled via Tailwind responsive classes. A new `<AdminTabBar />` lives at the bottom of mobile viewports only (3 tabs: Shlokas / Students / Me). Edit + new pages get a friendly `<UseDesktopPrompt />` card on mobile.

**Tech Stack:** Next.js 15, React 19, Tailwind 4. No new deps. No backend changes.

**Spec:** `docs/superpowers/specs/2026-05-30-admin-mobile-design.md`

---

## File Structure

**Frontend (`kayachikitsasutrani/`):**

Create:
- `src/components/admin/AdminTabBar.tsx` — 3-tab bottom nav, mobile only
- `src/components/admin/UseDesktopPrompt.tsx` — "Open on desktop" card
- `src/app/admin/me/page.tsx` — Next.js page entry
- `src/app/admin/me/Me.tsx` — admin profile content

Modify:
- `src/app/admin/layout.tsx` — wrap children + render `<AdminTabBar />` on mobile
- `src/app/admin/shlokas/ShlokaListPage.tsx` — wrap existing JSX in `hidden md:block`, add mobile card list in `md:hidden`
- `src/app/admin/shlokas/new/NewShlokaPage.tsx` — `<UseDesktopPrompt />` on mobile, existing form on desktop
- `src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx` — same pattern
- `src/app/admin/students/StudentListPage.tsx` — mobile row list + existing table on desktop
- `src/app/admin/students/[id]/StudentDetailPage.tsx` — mobile stacked card + existing layout on desktop

**Backend:** no changes.

---

## Task 1: AdminTabBar + UseDesktopPrompt components

**Files:**
- Create: `src/components/admin/AdminTabBar.tsx`
- Create: `src/components/admin/UseDesktopPrompt.tsx`

- [ ] **Step 1: Create `src/components/admin/AdminTabBar.tsx`**

```tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  icon: string;
  label: string;
  matchPrefix?: string;
}

const tabs: Tab[] = [
  { href: "/admin/shlokas", icon: "📚", label: "Shlokas", matchPrefix: "/admin/shlokas" },
  { href: "/admin/students", icon: "👥", label: "Students", matchPrefix: "/admin/students" },
  { href: "/admin/me", icon: "👤", label: "Me", matchPrefix: "/admin/me" },
];

const AdminTabBar: React.FC = () => {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5DDD0] flex justify-around pb-safe z-40">
      {tabs.map((t) => {
        const active = pathname === t.href || (t.matchPrefix ? pathname?.startsWith(t.matchPrefix) : false);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`touch-target flex flex-col items-center gap-0.5 px-3 py-2 text-xs ${
              active ? "text-accent font-bold" : "text-gray-500"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="text-xl leading-none" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default AdminTabBar;
```

- [ ] **Step 2: Create `src/components/admin/UseDesktopPrompt.tsx`**

```tsx
"use client";

import React from "react";
import Link from "next/link";

interface Props {
  title?: string;
  body?: string;
  backHref: string;
  backLabel: string;
}

const UseDesktopPrompt: React.FC<Props> = ({
  title = "Open on desktop",
  body = "This page needs more space than a phone can offer. Open on a desktop or tablet to continue editing.",
  backHref,
  backLabel,
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-6">
      <div className="bg-white border border-[#E5DDD0] rounded-2xl p-6 max-w-sm w-full text-center">
        <div className="text-5xl mb-3" aria-hidden="true">💻</div>
        <h2 className="text-base font-bold text-brown">{title}</h2>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{body}</p>
        <Link
          href={backHref}
          className="inline-block mt-5 bg-accent text-white rounded-full py-2.5 px-5 font-semibold text-sm hover:opacity-90 transition"
        >
          ← {backLabel}
        </Link>
      </div>
    </div>
  );
};

export default UseDesktopPrompt;
```

- [ ] **Step 3: tsc check**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
npx tsc --noEmit
```

Expected: clean (no output).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminTabBar.tsx src/components/admin/UseDesktopPrompt.tsx
git commit -m "feat(admin-mobile): AdminTabBar + UseDesktopPrompt components"
```

---

## Task 2: Admin layout — add tab bar + safe-area padding

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/admin/layout.tsx
```

It should currently be:
```tsx
import React from "react";
import { AdminGuard } from "@/lib/auth/AdminGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
```

- [ ] **Step 2: Replace contents**

```tsx
import React from "react";
import { AdminGuard } from "@/lib/auth/AdminGuard";
import AdminTabBar from "@/components/admin/AdminTabBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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

- [ ] **Step 3: tsc + build smoke**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

Expected: build succeeds. All admin routes still present.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(admin-mobile): mount AdminTabBar + safe-area padding in admin layout"
```

---

## Task 3: ShlokaListPage — dual layout

**Files:**
- Modify: `src/app/admin/shlokas/ShlokaListPage.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/admin/shlokas/ShlokaListPage.tsx
```

The file currently exports a `ShlokaListPage` component with `items`, `nextCursor`, `status`, `search`, `loading`, `error`, `toDelete`, `deleting` state and a `fetchPage` function. **Preserve all of that** — only change the return JSX.

- [ ] **Step 2: Rewrite the return JSX (keep everything above it intact)**

Find the `return (` line — replace the entire returned tree with:

```tsx
return (
  <>
    {/* ── Desktop ─────────────────────────────────────────────────── */}
    <div className="hidden md:block p-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl text-brown">Shlokas</h1>
        <Link
          href="/admin/shlokas/new"
          className="bg-green text-white px-3 py-1.5 text-sm rounded hover:opacity-90"
        >
          + New
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {(["all", "draft", "published"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1 rounded border ${
              status === s ? "bg-green text-white border-green" : "border-gray-300 text-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search title or slug"
        className="border px-2 py-1 rounded text-sm mb-3 max-w-sm w-full"
      />

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <table className="w-full text-sm bg-white/40 rounded">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">Title</th>
            <th className="p-2">Slug</th>
            <th className="p-2">Status</th>
            <th className="p-2">Lines</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className="border-b last:border-b-0">
              <td className="p-2">{s.title}</td>
              <td className="p-2 font-mono text-xs">{s.slug}</td>
              <td className="p-2"><StatusPill status={s.status} /></td>
              <td className="p-2">{s.lines?.length ?? 0}</td>
              <td className="p-2 space-x-2">
                <Link
                  href={`/admin/shlokas/${s.id}/edit`}
                  className="text-green underline text-xs"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setToDelete(s)}
                  className="text-red-600 underline text-xs"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {loading && <p className="text-sm text-gray-500 mt-3">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-gray-500 italic mt-3">No shlokas match.</p>
      )}
      {nextCursor && (
        <button
          type="button"
          onClick={() => void fetchPage(nextCursor, false)}
          className="mt-3 text-xs text-green underline"
        >
          Load more
        </button>
      )}
    </div>

    {/* ── Mobile ──────────────────────────────────────────────────── */}
    <div className="md:hidden px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brown">Shlokas</h1>
        <Link
          href="/admin/shlokas/new"
          className="bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded-full"
        >
          + New
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "draft", "published"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              status === s
                ? "bg-accent text-white"
                : "bg-white border border-[#E5DDD0] text-brown"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search title or slug"
        className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-2.5 text-sm text-brown outline-none focus:border-accent"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-gray-500 italic">No shlokas match.</p>
      )}

      {filtered.map((s) => (
        <Link
          key={s.id}
          href={`/admin/shlokas/${s.id}/edit`}
          className="bg-white border border-[#E5DDD0] rounded-xl p-3 flex flex-col gap-1.5 hover:bg-white/80 transition"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-brown truncate flex-1">{s.title}</div>
            <StatusPill status={s.status} />
          </div>
          <div className="text-[10px] font-mono text-gray-500 truncate">{s.slug}</div>
          <div className="text-[10px] text-gray-500">{s.lines?.length ?? 0} lines</div>
        </Link>
      ))}

      {nextCursor && (
        <button
          type="button"
          onClick={() => void fetchPage(nextCursor, false)}
          className="text-center text-xs text-accent font-semibold py-2"
        >
          Load more
        </button>
      )}
    </div>

    {/* Shared modal */}
    {toDelete && (
      <ConfirmDeleteModal
        title={`Delete "${toDelete.title}"?`}
        body="This permanently removes the shloka and its audio."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await api.admin.shlokas.remove(toDelete.id);
            setToDelete(null);
            void fetchPage();
          } catch (err) {
            const e = err as ApiError;
            setError(e.message);
          } finally {
            setDeleting(false);
          }
        }}
      />
    )}
  </>
);
```

If the existing component used a different return-time helper (e.g., a `filtered` variable, a `ConfirmDeleteModal` import path) — use the names that ARE present in the file. Don't introduce new identifiers; only the JSX structure changes.

- [ ] **Step 3: tsc + build smoke**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/shlokas/ShlokaListPage.tsx
git commit -m "feat(admin-mobile): ShlokaListPage dual layout (mobile cards + desktop table)"
```

---

## Task 4: NewShlokaPage — UseDesktopPrompt on mobile

**Files:**
- Modify: `src/app/admin/shlokas/new/NewShlokaPage.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/admin/shlokas/new/NewShlokaPage.tsx
```

After the recent save-draft fix, the file currently returns a `<ShlokaForm onSaved={...} />` directly.

- [ ] **Step 2: Wrap in dual layout**

Replace the `return (...)` with:

```tsx
return (
  <>
    <div className="md:hidden">
      <UseDesktopPrompt
        backHref="/admin/shlokas"
        backLabel="Back to shlokas"
        body="Creating a shloka needs the waveform editor — open this page on a desktop or tablet."
      />
    </div>
    <div className="hidden md:block">
      <ShlokaForm
        onSaved={(saved, status) => {
          if (status === "published") {
            router.push("/admin/shlokas");
          } else {
            // Draft saved from /new — move to the edit URL so future saves
            // hit PATCH /:id instead of creating duplicates.
            router.replace(`/admin/shlokas/${saved.id}/edit`);
          }
        }}
      />
    </div>
  </>
);
```

Add this import at the top of the file:

```tsx
import UseDesktopPrompt from "@/components/admin/UseDesktopPrompt";
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/app/admin/shlokas/new/NewShlokaPage.tsx
git commit -m "feat(admin-mobile): UseDesktopPrompt on mobile for new shloka page"
```

---

## Task 5: EditShlokaPage — UseDesktopPrompt on mobile

**Files:**
- Modify: `src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx`

- [ ] **Step 1: Read current file**

```bash
cat "src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx"
```

It currently fetches `shloka` by id then returns a `<ShlokaForm initial={shloka} onSaved={...} />` block.

- [ ] **Step 2: Wrap in dual layout**

Replace the final return — keep the loading + error early returns:

```tsx
if (error) return <div className="p-10 text-red-600">{error}</div>;
if (!shloka) return <div className="p-10 text-brown">Loading…</div>;

return (
  <>
    <div className="md:hidden">
      <UseDesktopPrompt
        backHref="/admin/shlokas"
        backLabel="Back to shlokas"
        body="Editing a shloka needs the waveform timing editor — open this page on a desktop or tablet."
      />
    </div>
    <div className="hidden md:block">
      <ShlokaForm
        initial={shloka}
        onSaved={(saved, status) => {
          if (status === "published") {
            router.push("/admin/shlokas");
          } else {
            // Draft saved — stay on page, refresh local snapshot with server's
            // canonical version so subsequent saves reuse the same id.
            setShloka(saved);
          }
        }}
      />
    </div>
  </>
);
```

Add this import at the top:

```tsx
import UseDesktopPrompt from "@/components/admin/UseDesktopPrompt";
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add "src/app/admin/shlokas/[id]/edit/EditShlokaPage.tsx"
git commit -m "feat(admin-mobile): UseDesktopPrompt on mobile for edit shloka page"
```

---

## Task 6: StudentListPage — dual layout

**Files:**
- Modify: `src/app/admin/students/StudentListPage.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/admin/students/StudentListPage.tsx
```

Note state shape: `items`, `nextCursor`, `search`, `loading`, `error`; helper `fetchPage`; derived `filtered`. The existing return renders a table with columns Name / Email / Role / Joined.

- [ ] **Step 2: Rewrite the return JSX**

Replace the entire returned tree:

```tsx
return (
  <>
    {/* ── Desktop ─────────────────────────────────────────────────── */}
    <div className="hidden md:block p-10">
      <h1 className="text-2xl text-brown mb-4">Students</h1>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or email"
        className="border px-2 py-1 rounded text-sm mb-3 max-w-sm w-full"
      />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <table className="w-full text-sm bg-white/40 rounded">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id} className="border-b last:border-b-0">
              <td className="p-2">
                <Link href={`/admin/students/${u.id}`} className="text-green underline">
                  {u.name}
                </Link>
              </td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {loading && <p className="text-sm text-gray-500 mt-3">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-gray-500 italic mt-3">No students match.</p>
      )}
      {nextCursor && (
        <button
          type="button"
          onClick={() => void fetchPage(nextCursor, false)}
          className="mt-3 text-xs text-green underline"
        >
          Load more
        </button>
      )}
    </div>

    {/* ── Mobile ──────────────────────────────────────────────────── */}
    <div className="md:hidden px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brown">Students</h1>
        <span className="text-xs text-gray-500">{filtered.length}</span>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search name or email"
        className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-2.5 text-sm text-brown outline-none focus:border-accent"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-gray-500 italic">No students match.</p>
      )}

      {filtered.map((u) => (
        <Link
          key={u.id}
          href={`/admin/students/${u.id}`}
          className="bg-white border border-[#E5DDD0] rounded-xl p-3 flex gap-3 items-center hover:bg-white/80 transition"
        >
          <AvatarCircle name={u.name} email={u.email} size={40} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-brown truncate">{u.name}</div>
            <div className="text-xs text-gray-500 truncate">{u.email}</div>
          </div>
          <span className="text-gray-400" aria-hidden="true">›</span>
        </Link>
      ))}

      {nextCursor && (
        <button
          type="button"
          onClick={() => void fetchPage(nextCursor, false)}
          className="text-center text-xs text-accent font-semibold py-2"
        >
          Load more
        </button>
      )}
    </div>
  </>
);
```

Add this import at the top:

```tsx
import AvatarCircle from "@/components/student/AvatarCircle";
```

- [ ] **Step 3: tsc + build + commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
git add src/app/admin/students/StudentListPage.tsx
git commit -m "feat(admin-mobile): StudentListPage dual layout (mobile rows + desktop table)"
```

---

## Task 7: StudentDetailPage — dual layout

**Files:**
- Modify: `src/app/admin/students/[id]/StudentDetailPage.tsx`

- [ ] **Step 1: Read current file**

```bash
cat "src/app/admin/students/[id]/StudentDetailPage.tsx"
```

The existing file fetches `user` by id, has loading/error early returns, then renders a single column with `<Row k v>` rows for Email/Role/Age/Gender/CollegeName/Course/Joined.

- [ ] **Step 2: Add mobile variant — keep desktop untouched**

Replace only the **final return JSX** (keep early returns + state + Row helper):

```tsx
return (
  <>
    {/* ── Desktop ─────────────────────────────────────────────────── */}
    <div className="hidden md:block p-10 max-w-2xl">
      <div className="mb-4">
        <Link href="/admin/students" className="text-sm text-green underline">← Back to students</Link>
      </div>
      <h1 className="text-2xl text-brown mb-4">{user.name}</h1>
      <div className="bg-white/40 rounded p-4">
        <Row k="Email" v={user.email} />
        <Row k="Role" v={user.role} />
        <Row k="Age" v={user.age} />
        <Row k="Gender" v={user.gender} />
        <Row k="College Name" v={user.collegeName} />
        <Row k="Course" v={user.course} />
        <Row k="Joined" v={new Date(user.createdAt).toLocaleString()} />
      </div>
    </div>

    {/* ── Mobile ──────────────────────────────────────────────────── */}
    <div className="md:hidden px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
      <Link href="/admin/students" className="text-sm text-accent font-semibold">
        ← Back to students
      </Link>

      {/* Profile card */}
      <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 text-center">
        <div className="flex justify-center">
          <AvatarCircle name={user.name} email={user.email} size={72} />
        </div>
        <div className="text-base font-bold text-brown mt-3">{user.name}</div>
        <div className="text-xs text-gray-500 mt-1">{user.email}</div>
        <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-accent-soft text-accent border border-accent rounded-full px-2 py-0.5">
          {user.role}
        </span>
      </div>

      {/* Info card */}
      <div className="bg-white border border-[#E5DDD0] rounded-xl overflow-hidden">
        <MobileRow label="Age" value={user.age?.toString()} />
        <MobileRow label="Gender" value={user.gender} />
        <MobileRow label="College" value={user.collegeName} />
        <MobileRow label="Course" value={user.course} />
        <MobileRow label="Joined" value={new Date(user.createdAt).toLocaleDateString()} last />
      </div>
    </div>
  </>
);
```

Add this `MobileRow` helper INSIDE the same file (above or below the main component, alongside the existing `Row` helper):

```tsx
const MobileRow: React.FC<{ label: string; value?: string; last?: boolean }> = ({ label, value, last }) => (
  <div
    className={`flex items-center justify-between px-3 py-2.5 ${last ? "" : "border-b border-[#F0E7D8]"}`}
  >
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm font-semibold text-brown text-right max-w-[180px] truncate">{value ?? "—"}</span>
  </div>
);
```

Add this import at the top:

```tsx
import AvatarCircle from "@/components/student/AvatarCircle";
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add "src/app/admin/students/[id]/StudentDetailPage.tsx"
git commit -m "feat(admin-mobile): StudentDetailPage stacked card layout on mobile"
```

---

## Task 8: `/admin/me` profile page

**Files:**
- Create: `src/app/admin/me/page.tsx`
- Create: `src/app/admin/me/Me.tsx`

- [ ] **Step 1: Create `src/app/admin/me/page.tsx`**

```tsx
import Me from "./Me";

export default function Page() {
  return <Me />;
}
```

- [ ] **Step 2: Create `src/app/admin/me/Me.tsx`**

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import AvatarCircle from "@/components/student/AvatarCircle";
import type { ApiError } from "@/lib/auth/types";

export default function Me() {
  const router = useRouter();
  const { state: authState, logout } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;

  const [published, setPublished] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);
  const [students, setStudents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.admin.shlokas.list({ status: "published", limit: 50 }),
      api.admin.shlokas.list({ status: "draft", limit: 50 }),
      api.admin.students.list({ limit: 50 }),
    ])
      .then(([pub, drf, stu]) => {
        if (cancelled) return;
        setPublished(pub.items.length);
        setDrafts(drf.items.length);
        setStudents(stu.items.length);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || "Failed to load stats");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!me) {
    return <p className="p-6 text-sm text-gray-500">Not signed in.</p>;
  }

  const joined = new Date((me as { createdAt?: string }).createdAt || Date.now()).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" },
  );

  return (
    <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto md:max-w-2xl">
      <h1 className="text-xl font-bold text-brown">Me</h1>

      {/* Avatar block */}
      <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 text-center">
        <div className="flex justify-center">
          <AvatarCircle name={me.name} email={me.email} size={72} />
        </div>
        <div className="text-base font-bold text-brown mt-3">{me.name}</div>
        <div className="text-xs text-gray-500 mt-1">{me.email}</div>
        <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-accent-soft text-accent border border-accent rounded-full px-2 py-0.5">
          {me.role}
        </span>
      </div>

      {/* Info card */}
      <div className="bg-white border border-[#E5DDD0] rounded-xl overflow-hidden">
        <Row label="Email" value={me.email} />
        <Row label="Joined" value={joined} last />
      </div>

      {/* Stats card */}
      <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Catalog</div>
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && (
          <div className="flex justify-around text-center">
            <Stat label="Published" value={published} />
            <Stat label="Drafts" value={drafts} />
            <Stat label="Students" value={students} />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <button
        type="button"
        disabled
        className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm font-semibold text-brown text-left opacity-60 cursor-not-allowed"
      >
        📝 Edit profile <span className="text-xs text-gray-400 ml-2">(coming soon)</span>
      </button>
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/login");
        }}
        className="bg-white border border-red-300 text-red-600 rounded-xl px-3 py-3 text-sm font-semibold text-left hover:bg-red-50 transition"
      >
        ↪ Log out
      </button>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value?: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 ${last ? "" : "border-b border-[#F0E7D8]"}`}
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-brown text-right max-w-[180px] truncate">{value ?? "—"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-lg font-bold text-brown">{value ?? "—"}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
```

- [ ] **Step 3: tsc + build + commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
git add src/app/admin/me/
git commit -m "feat(admin-mobile): /admin/me profile page with stats + logout"
```

---

## Task 9: Final tsc / lint / build verification

**Files:** none.

- [ ] **Step 1: Run all checks**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
echo "=== TSC ==="
npx tsc --noEmit 2>&1 | tail -20
echo ""
echo "=== LINT ==="
npm run lint 2>&1 | tail -20
echo ""
echo "=== BUILD ==="
npm run build 2>&1 | tail -25
```

Expected: all clean. Pre-existing warnings about unused `eslint-disable` directives are acceptable.

- [ ] **Step 2: Fix any issues inline**

Likely candidates:
- Unused `Row` helper imported but never used in StudentDetailPage (left over from desktop block) — leave it; it IS still used in the desktop block.
- Type errors on `PublicUser.createdAt` access — the type already includes it from the rename task. If the build complains, paste the error.
- Missing alt text on `<img>` — none are added by this plan; all icons are emoji + aria-hidden.

- [ ] **Step 3: Commit any fix-ups (idempotent)**

```bash
git add -A
git commit -m "fix(admin-mobile): final tsc/lint cleanup" --allow-empty
```

---

## Task 10: Push + manual QA

**Files:** none.

- [ ] **Step 1: Push**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
git push origin main
```

- [ ] **Step 2: Wait ~2 minutes for Vercel redeploy**

- [ ] **Step 3: Mobile QA (resize browser to ≤640 px OR open on phone)**

| # | Action | Expected |
|---|---|---|
| 1 | Sign in as admin → /admin/shlokas | Card list with status pill + slug + line count. Bottom tab bar visible (Shlokas / Students / Me) |
| 2 | Tap status chip (Drafts) | Filter applies |
| 3 | Tap "+ New" | Shows UseDesktopPrompt card with "Back to shlokas" button |
| 4 | Tap a card | Shows UseDesktopPrompt (edit) with "Back to shlokas" button |
| 5 | Tap "Students" tab | Row list with avatar + name + email; tap student → mobile profile card layout |
| 6 | Tap "Me" tab | Avatar block + Role pill + Email + Joined + Catalog stats (Published / Drafts / Students) + Log out |
| 7 | Tap "Log out" | Redirects to /login |
| 8 | Sign back in → resize browser ≥768 px | Desktop layouts return; tab bar hidden; existing Navbar visible |
| 9 | /admin/shlokas/[id]/edit on desktop | Full waveform editor renders (unchanged) |

- [ ] **Step 4: Report**

If any failure: paste page + symptom.

---

## Verification Checklist

- [ ] Frontend: `npx tsc --noEmit` clean
- [ ] Frontend: `npm run lint` clean
- [ ] Frontend: `npm run build` succeeds; all admin routes still present in route table
- [ ] Mobile QA (Task 10) passes
- [ ] Desktop unchanged at `md+` viewport
- [ ] /admin/me loads stats from existing endpoints (no backend changes needed)
