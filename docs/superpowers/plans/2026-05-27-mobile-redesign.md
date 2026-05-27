# Mobile-First Student Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all student-facing pages mobile-first. Add bottom tab navigation, sticky mini-player on shloka detail, and two new pages (`/my-shlokas`, `/me`) backed by a new `GET /api/me/completions` endpoint.

**Architecture:** Next.js 15 route group `(student)` wraps authenticated student pages with a shared layout (top bar + tab bar). Sticky mini-player extracted as its own component. Existing `useShlokaPlayer` hook + `ShlokaDisplay` reused unchanged for state/highlighting. New backend endpoint computes per-shloka rank by reusing the dense-rank algorithm from `completions.ts`.

**Tech Stack:** Next.js 15.3, React 19, Tailwind 4, Node/Express/Mongoose. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-27-mobile-redesign-design.md`

---

## File Structure

**Backend (`shloka-backend/`):**
- Create: `src/routes/me.ts` — GET /api/me/completions
- Modify: `src/server.ts` — mount router
- Create: `tests/me.integration.test.ts`

**Frontend (`kayachikitsasutrani/`):**
- Modify: `src/app/layout.tsx` — viewport + theme-color meta
- Modify: `src/app/globals.css` — pb-safe, amber accent, mobile utilities
- Modify: `src/app/page.tsx` — landing content
- Modify: `src/app/login/Login.tsx` — mobile-first
- Modify: `src/app/signup/Signup.tsx` — mobile-first
- Modify: `src/app/home/home.tsx` — mobile-first list + stats
- Modify: `src/app/dashboard/page.tsx` — redirect to /home
- Modify: `src/app/shloka/[slug]/ShlokaDesc.jsx` — sticky player + accordions
- Modify: `src/app/shloka/[slug]/ShlokaDisplay.jsx` — mobile font sizing
- Modify: `src/app/shloka/[slug]/Leaderboard.tsx` — compact rows
- Modify: `src/lib/api.ts` — add `api.me.completions()`
- Modify: `src/lib/auth/types.ts` — add types
- Create: `src/app/(student)/layout.tsx` — route group with tab bar
- Create: `src/app/my-shlokas/page.tsx` + `MyShlokas.tsx`
- Create: `src/app/me/page.tsx` + `Me.tsx`
- Create: `src/components/student/TabBar.tsx`
- Create: `src/components/student/TopBar.tsx`
- Create: `src/components/student/ShlokaListItem.tsx`
- Create: `src/components/student/MiniPlayer.tsx`
- Create: `src/components/student/StatsBanner.tsx`
- Create: `src/components/student/AvatarCircle.tsx`
- Delete: `src/app/dashboard/Dashboard.jsx`, `src/app/dashboard/components/`

---

## Task 1: Backend — `/api/me/completions` endpoint + tests

**Files:**
- Create: `src/routes/me.ts`
- Modify: `src/server.ts`
- Create: `tests/me.integration.test.ts`

Working dir: `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend`

- [ ] **Step 1: Write the failing test file**

Create `tests/me.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

vi.mock('cloudinary', async () => await import('../__mocks__/cloudinary.js'));

import { buildApp } from '../src/server.js';
import { User } from '../src/models/User.js';
import { Shloka } from '../src/models/Shloka.js';
import { ShlokaCompletion } from '../src/models/ShlokaCompletion.js';
import { hashPassword } from '../src/lib/password.js';
import { signSession } from '../src/lib/jwt.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_PASSWORD = 'strongpw1';
  process.env.ADMIN_NAME = 'Admin';
  process.env.CLOUDINARY_CLOUD_NAME = 'demo';
  process.env.CLOUDINARY_API_KEY = '123';
  process.env.CLOUDINARY_API_SECRET = 'sssss';
  await mongoose.connect(mongod.getUri());
  app = buildApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function seedShloka(slug: string) {
  const u = await User.create({
    email: `creator-${slug}@x.test`,
    passwordHash: 'x',
    role: 'admin',
    name: 'Creator',
  });
  return Shloka.create({
    slug,
    title: `Title ${slug}`,
    meaning: 'm',
    translation: 't',
    status: 'published',
    audio: { full: { url: 'u', publicId: 'p' }, lines: [{ url: 'u', publicId: 'p1' }] },
    lines: [{
      sanskrit: 'a',
      words: [{ text: 'a', start: 0, end: 1 }],
      fullTimings: [{ text: 'a', start: 0, end: 1 }],
    }],
    createdBy: u._id,
  });
}

async function seedStudent(email: string, name: string) {
  return User.create({
    email,
    passwordHash: await hashPassword('password1'),
    role: 'student',
    name,
  });
}

function cookieFor(userId: string): string {
  return `sht_session=${signSession(userId, 'a'.repeat(32))}`;
}

beforeEach(async () => {
  await ShlokaCompletion.deleteMany({});
  await Shloka.deleteMany({});
  await User.deleteMany({});
});

describe('GET /api/me/completions', () => {
  it('returns empty list when user has no completions', async () => {
    const student = await seedStudent('a@x.test', 'Aakash');
    const res = await request(app).get('/api/me/completions')
      .set('Cookie', cookieFor(student._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it('returns user completions sorted by completedAt DESC with per-shloka rank', async () => {
    const sh1 = await seedShloka('s1');
    const sh2 = await seedShloka('s2');
    const me = await seedStudent('me@x.test', 'Me');
    const other = await seedStudent('other@x.test', 'Other');
    // On s1: other completes faster, so me is #2
    await ShlokaCompletion.create({ userId: other._id, shlokaId: sh1._id, completedAt: new Date('2026-05-25T10:00:00Z'), attempts: 1, elapsedSeconds: 30 });
    await ShlokaCompletion.create({ userId: me._id,    shlokaId: sh1._id, completedAt: new Date('2026-05-25T11:00:00Z'), attempts: 1, elapsedSeconds: 60 });
    // On s2: me alone, so #1
    await ShlokaCompletion.create({ userId: me._id,    shlokaId: sh2._id, completedAt: new Date('2026-05-26T10:00:00Z'), attempts: 2, elapsedSeconds: 80 });

    const res = await request(app).get('/api/me/completions')
      .set('Cookie', cookieFor(me._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    // Most recent first → s2 then s1
    expect(res.body.items[0].slug).toBe('s2');
    expect(res.body.items[0].rank).toBe(1);
    expect(res.body.items[0].totalCompletions).toBe(1);
    expect(res.body.items[0].title).toBe('Title s2');
    expect(res.body.items[1].slug).toBe('s1');
    expect(res.body.items[1].rank).toBe(2);
    expect(res.body.items[1].totalCompletions).toBe(2);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/me/completions');
    expect(res.status).toBe(401);
  });

  it('excludes completions on drafts when called as student', async () => {
    // Edge case: a shloka was published, completed, then moved to draft.
    // Spec doesn't require hiding such rows; just verify the endpoint doesn't crash.
    const sh = await seedShloka('s1');
    const me = await seedStudent('me@x.test', 'Me');
    await ShlokaCompletion.create({ userId: me._id, shlokaId: sh._id, completedAt: new Date(), attempts: 1, elapsedSeconds: 30 });
    sh.status = 'draft';
    await sh.save();
    const res = await request(app).get('/api/me/completions')
      .set('Cookie', cookieFor(me._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].slug).toBe('s1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend
npm test -- me.integration 2>&1 | tail -15
```

Expected: 4 failures — endpoint `/api/me/completions` returns 404 (router not mounted).

- [ ] **Step 3: Write `src/routes/me.ts`**

Create the file with the endpoint:

```ts
import { Router } from 'express';
import { Shloka } from '../models/Shloka.js';
import { ShlokaCompletion } from '../models/ShlokaCompletion.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const meRouter = Router();

meRouter.use(requireAuth);

function denseRank<T>(items: T[], compare: (a: T, b: T) => number): Map<T, number> {
  const sorted = [...items].sort(compare);
  const ranks = new Map<T, number>();
  let lastKey: T | null = null;
  let lastRank = 0;
  sorted.forEach((item, idx) => {
    if (lastKey !== null && compare(lastKey, item) === 0) {
      ranks.set(item, lastRank);
    } else {
      lastRank = idx + 1;
      ranks.set(item, lastRank);
      lastKey = item;
    }
  });
  return ranks;
}

meRouter.get('/completions', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const myCompletions = await ShlokaCompletion.find({ userId }).lean();
    if (myCompletions.length === 0) {
      res.json({ total: 0, items: [] });
      return;
    }
    const shlokaIds = myCompletions.map((c) => c.shlokaId);
    const shlokas = await Shloka.find({ _id: { $in: shlokaIds } }).lean();
    const shlokaMap = new Map(shlokas.map((s) => [s._id.toString(), s]));

    // For each shloka the user completed, fetch ALL completions to compute their rank
    const allCompletionsByShloka = new Map<string, Array<{ _id: unknown; userId: unknown; completedAt: Date; attempts: number; elapsedSeconds: number }>>();
    for (const sid of shlokaIds) {
      const all = await ShlokaCompletion.find({ shlokaId: sid }).lean();
      allCompletionsByShloka.set(sid.toString(), all as unknown as typeof allCompletionsByShloka extends Map<string, infer V> ? V : never);
    }

    const items = myCompletions.map((c) => {
      const sid = c.shlokaId.toString();
      const shloka = shlokaMap.get(sid);
      const all = allCompletionsByShloka.get(sid) || [];
      // Compute rank using dense-rank-average algorithm (same as completions.ts)
      const chronoRanks = denseRank(all, (a, b) => (a.completedAt as Date).getTime() - (b.completedAt as Date).getTime());
      const timeRanks = denseRank(all, (a, b) => a.elapsedSeconds - b.elapsedSeconds);
      const attemptsRanks = denseRank(all, (a, b) => a.attempts - b.attempts);
      // Compute average rank per completion, sort, find user's position
      const sortedByAvg = [...all].sort((a, b) => {
        const aAvg = ((chronoRanks.get(a) || 0) + (timeRanks.get(a) || 0) + (attemptsRanks.get(a) || 0)) / 3;
        const bAvg = ((chronoRanks.get(b) || 0) + (timeRanks.get(b) || 0) + (attemptsRanks.get(b) || 0)) / 3;
        if (aAvg !== bAvg) return aAvg - bAvg;
        return (a.completedAt as Date).getTime() - (b.completedAt as Date).getTime();
      });
      const myIdx = sortedByAvg.findIndex((x) => (x as { userId: { toString(): string } }).userId.toString() === userId);
      return {
        shlokaId: sid,
        slug: shloka?.slug ?? '',
        title: shloka?.title ?? '',
        completedAt: (c.completedAt as Date).toISOString(),
        attempts: c.attempts,
        elapsedSeconds: c.elapsedSeconds,
        rank: myIdx >= 0 ? myIdx + 1 : 0,
        totalCompletions: all.length,
      };
    });

    items.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    res.json({ total: items.length, items });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Mount router in `src/server.ts`**

Add to the imports block:

```ts
import { meRouter } from './routes/me.js';
```

In `buildApp`, near the other `/api/*` mounts (after the completions router mount), add:

```ts
  app.use('/api/me', meRouter);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- me.integration 2>&1 | tail -10
```

Expected: 4 passed.

Then run full suite:

```bash
npm test 2>&1 | tail -5
```

Expected: ~103 passed.

- [ ] **Step 6: tsc check + commit**

```bash
npx tsc --noEmit
git add src/routes/me.ts src/server.ts tests/me.integration.test.ts
git commit -m "feat: GET /api/me/completions endpoint with per-shloka rank"
```

---

## Task 2: Frontend — viewport meta + globals.css mobile utilities

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

Working dir: `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani`

- [ ] **Step 1: Read current layout.tsx**

```bash
cat src/app/layout.tsx
```

Note the existing structure so the metadata export can be merged without breaking it.

- [ ] **Step 2: Update `src/app/layout.tsx` to add viewport export**

Next.js 15 expects viewport in a separate `viewport` export (not inside `metadata`). Add this export to the file (after any existing `export const metadata = ...`):

```tsx
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#A67C52",
};
```

If `Viewport` import or another `viewport` export already exists, merge into it rather than duplicating.

- [ ] **Step 3: Append mobile utilities to `src/app/globals.css`**

Append at the END of the file:

```css
/* ──────────────────────────────────────────────────────────────────────
 * Mobile-first utilities (added 2026-05-27)
 * ────────────────────────────────────────────────────────────────────── */

/* Safe-area-inset-bottom padding for sticky bottom UI on iPhone notch */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
.pb-safe-tab {
  padding-bottom: calc(56px + env(safe-area-inset-bottom));
}
.pb-safe-tab-with-player {
  padding-bottom: calc(56px + 86px + env(safe-area-inset-bottom));
}

/* Amber accent — new for mobile redesign */
.bg-accent { background-color: #D4A574; }
.text-accent { color: #D4A574; }
.border-accent { border-color: #D4A574; }
.bg-accent-soft { background-color: #FDF5E6; }

/* Touch target helper — ensures min 44x44 hit area */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Tab bar entry animation */
@keyframes tab-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.anim-tab-fade-in { animation: tab-fade-in 200ms ease-out both; }

/* Mini-player slide-up animation */
@keyframes player-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.anim-player-slide-up { animation: player-slide-up 280ms ease-out both; }
```

- [ ] **Step 4: tsc check + commit**

```bash
npx tsc --noEmit
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(mobile): viewport meta, theme-color, pb-safe + accent utilities"
```

---

## Task 3: Frontend — AvatarCircle + TabBar + TopBar components

**Files:**
- Create: `src/components/student/AvatarCircle.tsx`
- Create: `src/components/student/TabBar.tsx`
- Create: `src/components/student/TopBar.tsx`

- [ ] **Step 1: Write `AvatarCircle.tsx`**

```tsx
"use client";

import React from "react";

interface Props {
  name: string;
  email: string;
  size?: number;
  className?: string;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function deriveColor(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 65%)`;
}

const AvatarCircle: React.FC<Props> = ({ name, email, size = 40, className = "" }) => {
  const initials = deriveInitials(name);
  const color = deriveColor(email);
  return (
    <span
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, background: color, fontSize: Math.floor(size * 0.4) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
};

export default AvatarCircle;
```

- [ ] **Step 2: Write `TabBar.tsx`**

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
  { href: "/home", icon: "🏠", label: "Home", matchPrefix: "/home" },
  { href: "/my-shlokas", icon: "📚", label: "My", matchPrefix: "/my-shlokas" },
  { href: "/me", icon: "👤", label: "Me", matchPrefix: "/me" },
];

const TabBar: React.FC = () => {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5DDD0] flex justify-around pb-safe z-40">
      {tabs.map((t) => {
        const active = pathname === t.href || (t.matchPrefix && pathname.startsWith(t.matchPrefix));
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

export default TabBar;
```

- [ ] **Step 3: Write `TopBar.tsx`**

```tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  trailing?: React.ReactNode;
}

const TopBar: React.FC<Props> = ({ title, subtitle, showBack = false, trailing }) => {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 bg-brown text-white flex items-center px-4 py-3 gap-3">
      {showBack && (
        <button
          type="button"
          onClick={() => router.back()}
          className="touch-target -ml-2"
          aria-label="Go back"
        >
          <span className="text-xl" aria-hidden="true">←</span>
        </button>
      )}
      <div className="flex-1 min-w-0">
        {subtitle && <div className="text-xs opacity-80 truncate">{subtitle}</div>}
        <div className="font-bold text-base truncate">{title}</div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </header>
  );
};

export default TopBar;
```

- [ ] **Step 4: tsc check + commit**

```bash
npx tsc --noEmit
git add src/components/student/AvatarCircle.tsx src/components/student/TabBar.tsx src/components/student/TopBar.tsx
git commit -m "feat(mobile): AvatarCircle, TabBar, TopBar components"
```

---

## Task 4: Frontend — `(student)` route group + move routes into it

**Files:**
- Create: `src/app/(student)/layout.tsx`
- Move: `src/app/home/` → `src/app/(student)/home/`
- Move: `src/app/shloka/` → `src/app/(student)/shloka/`

(Note: in Next.js, parens-prefixed folders are route groups — they don't appear in the URL. So `/home` stays at `/home`.)

- [ ] **Step 1: Create `(student)` directory + layout**

```bash
mkdir -p src/app/\(student\)
```

Create `src/app/(student)/layout.tsx`:

```tsx
"use client";

import React from "react";
import TabBar from "@/components/student/TabBar";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="flex-1 pb-safe-tab">
        {children}
      </div>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 2: Move `/home` and `/shloka` into the group**

```bash
git mv src/app/home src/app/\(student\)/home
git mv src/app/shloka src/app/\(student\)/shloka
```

Verify the URLs still work — route groups don't change the URL. After moving, `src/app/(student)/home/page.tsx` still serves at `/home`.

- [ ] **Step 3: Verify build still works**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds; routes `/home` and `/shloka/[slug]` still present in the printed route table.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(student\)/
git commit -m "feat(mobile): (student) route group with tab bar layout"
```

---

## Task 5: Frontend — frontend types + api.me.completions()

**Files:**
- Modify: `src/lib/auth/types.ts` (append)
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Append types to `src/lib/auth/types.ts`**

Add at the end of the file:

```ts
// ── My Completions ────────────────────────────────────────────────────────

export interface MyCompletionRow {
  shlokaId: string;
  slug: string;
  title: string;
  completedAt: string;
  attempts: number;
  elapsedSeconds: number;
  rank: number;
  totalCompletions: number;
}

export interface MyCompletionsResponse {
  total: number;
  items: MyCompletionRow[];
}
```

- [ ] **Step 2: Extend api client**

In `src/lib/api.ts`:

(a) Add `MyCompletionsResponse` to the type import from `./auth/types`:

```ts
import type {
  // existing imports …
  MyCompletionsResponse,
} from "./auth/types";
```

(b) Add a new `me` block to the `api` object (alongside `shlokas`, `auth`, etc.):

```ts
  me: {
    completions: () => request<MyCompletionsResponse>(`/api/me/completions`),
  },
```

- [ ] **Step 3: tsc check + commit**

```bash
npx tsc --noEmit
git add src/lib/auth/types.ts src/lib/api.ts
git commit -m "feat(mobile): types + api client for /api/me/completions"
```

---

## Task 6: Frontend — Landing page rewrite

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx` content**

```tsx
import Link from "next/link";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      {/* Hero */}
      <div
        className="px-6 pt-16 pb-10 text-center text-white"
        style={{
          background: "linear-gradient(135deg, #8B6F4F 0%, #A67C52 50%, #C9A878 100%)",
        }}
      >
        <div className="text-5xl mb-2" aria-hidden="true">📜</div>
        <h1 className="text-3xl font-bold">Shloka Sutra</h1>
        <p className="mt-2 text-sm opacity-90 max-w-sm mx-auto">
          Learn Ayurvedic shlokas through guided audio recitation
        </p>
      </div>

      {/* Features */}
      <div className="flex-1 px-6 py-6 flex flex-col gap-3 max-w-md mx-auto w-full">
        <Feature icon="🎧" title="Listen & repeat" desc="Each line plays 3 times. Full shloka 3 times." />
        <Feature icon="✨" title="Per-word highlight" desc="Words light up as they're spoken — never lose your place." />
        <Feature icon="🏆" title="Leaderboards" desc="Compete on speed, attempts, and order completed." />

        <div className="flex-1" />

        <Link
          href="/signup"
          className="bg-accent text-white rounded-full py-3 px-6 text-center font-bold text-sm shadow-sm hover:opacity-90 transition"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="border border-accent text-brown rounded-full py-3 px-6 text-center font-semibold text-sm hover:bg-accent-soft transition"
        >
          I already have an account
        </Link>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white border border-[#E5DDD0] rounded-xl p-4 flex gap-3 items-start">
      <span className="text-2xl shrink-0" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-bold text-brown">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc check + commit**

```bash
npx tsc --noEmit
git add src/app/page.tsx
git commit -m "feat(mobile): landing page with hero + features + CTAs"
```

---

## Task 7: Frontend — Login mobile rewrite

**Files:**
- Modify: `src/app/login/Login.tsx`

- [ ] **Step 1: Read current Login.tsx**

```bash
cat src/app/login/Login.tsx
```

Identify the existing form state, submit handler, and `useAuth` hook usage. Keep those intact — only change the layout/styling.

- [ ] **Step 2: Rewrite the component's return JSX**

Replace the JSX `return (...)` block with this mobile-first markup (keep all existing state hooks + handlers above the return):

```tsx
return (
  <div className="min-h-screen bg-cream flex flex-col">
    <header className="bg-brown text-white px-4 py-3 flex items-center gap-3">
      <button type="button" onClick={() => router.back()} className="touch-target -ml-2" aria-label="Go back">
        <span className="text-xl" aria-hidden="true">←</span>
      </button>
      <div className="flex-1 text-center font-bold text-base">Sign in</div>
      <div className="w-6" />
    </header>

    <form onSubmit={handleSubmit} className="flex-1 px-6 py-8 flex flex-col gap-4 max-w-md mx-auto w-full">
      <div className="text-center mb-4">
        <div className="text-4xl" aria-hidden="true">📜</div>
        <h2 className="text-lg font-bold text-brown mt-2">Welcome back</h2>
        <p className="text-xs text-gray-500 mt-1">Sign in to continue learning</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent text-white rounded-full py-3 px-6 font-bold text-sm shadow-sm hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <div className="text-center text-xs text-gray-500 mt-2">
        Don't have an account? <Link href="/signup" className="text-accent font-bold">Sign up</Link>
      </div>
    </form>
  </div>
);
```

If the existing component uses different variable names (e.g., `formData.email` instead of `email`), adapt the bindings to match — do NOT introduce new state shape.

Required imports at the top:

```tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
```

Add `const router = useRouter();` near the top of the component body if not already present.

- [ ] **Step 3: tsc check + build smoke**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/login/Login.tsx
git commit -m "feat(mobile): login page mobile-first redesign"
```

---

## Task 8: Frontend — Signup mobile rewrite

**Files:**
- Modify: `src/app/signup/Signup.tsx`

- [ ] **Step 1: Read current Signup.tsx**

```bash
cat src/app/signup/Signup.tsx
```

Preserve: `COURSE_OPTIONS` const, form state shape, `update` helper, `handleSubmit`, course dropdown logic.

- [ ] **Step 2: Rewrite the JSX return block**

Replace the JSX `return (...)` block with mobile-first markup. Keep all hooks/state/handlers untouched:

```tsx
return (
  <div className="min-h-screen bg-cream flex flex-col">
    <header className="bg-brown text-white px-4 py-3 flex items-center gap-3">
      <button type="button" onClick={() => router.back()} className="touch-target -ml-2" aria-label="Go back">
        <span className="text-xl" aria-hidden="true">←</span>
      </button>
      <div className="flex-1 text-center font-bold text-base">Create account</div>
      <div className="w-6" />
    </header>

    <form onSubmit={handleSubmit} className="flex-1 px-6 py-6 flex flex-col gap-3 max-w-md mx-auto w-full">
      <Field id="name" label="Full Name" type="text" placeholder="Your name" value={formData.name} onChange={update("name")} required />
      <Field id="email" label="Email" type="email" placeholder="your@email.com" value={formData.email} onChange={update("email")} required autoComplete="email" />
      <Field id="password" label="Password" type="password" placeholder="At least 8 characters" value={formData.password} onChange={update("password")} required autoComplete="new-password" />
      <Field id="collegeName" label="College Name" type="text" placeholder="College you have enrolled in" value={formData.collegeName} onChange={update("collegeName")} />

      <div className="flex flex-col gap-1">
        <label htmlFor="course" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Course / Program</label>
        <select
          id="course"
          name="course"
          value={formData.course}
          onChange={update("course")}
          className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
        >
          {COURSE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent text-white rounded-full py-3 px-6 font-bold text-sm mt-2 shadow-sm hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <div className="text-center text-xs text-gray-500 mt-2">
        Already have an account? <Link href="/login" className="text-accent font-bold">Sign in</Link>
      </div>
    </form>
  </div>
);
```

Add this local `Field` component INSIDE the same file (above or below the main component):

```tsx
function Field({
  id, label, type, placeholder, value, onChange, required, autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-3 text-sm text-brown outline-none focus:border-accent"
      />
    </div>
  );
}
```

Required imports at top:

```tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
```

Add `const router = useRouter();` in component body if missing.

- [ ] **Step 3: tsc + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/signup/Signup.tsx
git commit -m "feat(mobile): signup page mobile-first redesign with extracted Field"
```

---

## Task 9: Frontend — Home page + ShlokaListItem + StatsBanner

**Files:**
- Modify: `src/app/(student)/home/home.tsx`
- Create: `src/components/student/ShlokaListItem.tsx`
- Create: `src/components/student/StatsBanner.tsx`

- [ ] **Step 1: Write `ShlokaListItem.tsx`**

```tsx
"use client";

import React from "react";
import Link from "next/link";

interface Props {
  slug: string;
  title: string;
  sanskritFirstLine?: string;
  done?: boolean;
  rank?: number;
  completedAt?: string;
  lineCount?: number;
  totalCompletions?: number;
  index?: number; // for thumbnail label when not done
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return "yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ShlokaListItem: React.FC<Props> = ({
  slug, title, sanskritFirstLine, done = false, rank, completedAt, lineCount, totalCompletions, index,
}) => {
  return (
    <Link
      href={`/shloka/${encodeURIComponent(slug)}`}
      className="bg-white border border-[#E5DDD0] rounded-xl p-3 flex gap-3 items-center hover:bg-white/80 transition"
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{
          background: done
            ? "linear-gradient(135deg,#7BA77B,#A5D6A7)"
            : "linear-gradient(135deg,#8B6F4F,#C9A878)",
        }}
        aria-hidden="true"
      >
        {done ? "✓" : (index !== undefined ? String(index) : "•")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-brown truncate">
          {sanskritFirstLine || title}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {done
            ? `Completed · ${completedAt ? timeAgo(completedAt) : ""}${rank ? ` · #${rank}${rank === 1 ? " 🏆" : ""}` : ""}`
            : `${lineCount ?? 0} lines${totalCompletions !== undefined ? ` · ${totalCompletions} completed` : ""}`}
        </div>
      </div>
      <span className="text-gray-400" aria-hidden="true">›</span>
    </Link>
  );
};

export default ShlokaListItem;
```

- [ ] **Step 2: Write `StatsBanner.tsx`**

```tsx
"use client";

import React from "react";

interface Stat {
  value: string | number;
  label: string;
}

const StatsBanner: React.FC<{ stats: Stat[] }> = ({ stats }) => {
  return (
    <div
      className="rounded-xl p-3.5 text-white flex justify-around text-center"
      style={{ background: "linear-gradient(135deg, #D4A574 0%, #C9A878 100%)" }}
    >
      {stats.map((s, i) => (
        <div key={i}>
          <div className="text-lg font-bold">{s.value}</div>
          <div className="text-[10px] opacity-90">{s.label}</div>
        </div>
      ))}
    </div>
  );
};

export default StatsBanner;
```

- [ ] **Step 3: Read current home.tsx to find the existing data flow**

```bash
cat "src/app/(student)/home/home.tsx"
```

Note: file path has parens — quote it.

Identify: how shlokas are fetched (likely `api.shlokas.list()`), the state shape, loading/error handling, and whether the file is `.tsx` or `.jsx`.

- [ ] **Step 4: Rewrite home.tsx**

Replace contents with:

```tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import TopBar from "@/components/student/TopBar";
import AvatarCircle from "@/components/student/AvatarCircle";
import ShlokaListItem from "@/components/student/ShlokaListItem";
import StatsBanner from "@/components/student/StatsBanner";
import type { PublicShloka, MyCompletionRow, ApiError } from "@/lib/auth/types";

export default function Home() {
  const { state: authState } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;
  const [shlokas, setShlokas] = useState<PublicShloka[]>([]);
  const [completions, setCompletions] = useState<MyCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.shlokas.list(), api.me.completions()])
      .then(([listRes, meRes]) => {
        if (cancelled) return;
        setShlokas(listRes.items);
        setCompletions(meRes.items);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const completionsBySlug = useMemo(
    () => new Map(completions.map((c) => [c.slug, c])),
    [completions]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return shlokas;
    const q = query.trim().toLowerCase();
    return shlokas.filter((s) =>
      s.title?.toLowerCase().includes(q) ||
      (s.lines?.[0]?.sanskrit ?? "").toLowerCase().includes(q)
    );
  }, [shlokas, query]);

  const firstName = me?.name?.split(/\s+/)[0] || "";
  const completedCount = completions.length;
  const total = shlokas.length;
  const progressPct = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  return (
    <div>
      <TopBar
        subtitle="Welcome back"
        title={firstName || "Shloka Sutra"}
        trailing={
          me ? <AvatarCircle name={me.name} email={me.email} size={34} /> : null
        }
      />
      <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
        <StatsBanner
          stats={[
            { value: completedCount, label: "Completed" },
            { value: total, label: "Available" },
            { value: `${progressPct}%`, label: "Progress" },
          ]}
        />

        <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-2">
          All Shlokas
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Search shlokas…"
          className="bg-white border border-[#E5DDD0] rounded-xl px-3 py-2.5 text-sm text-brown outline-none focus:border-accent"
        />

        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <p className="text-sm text-gray-500 italic mt-2">No shlokas match your search.</p>
        )}

        {!loading && !error && filtered.map((sh, i) => {
          const c = completionsBySlug.get(sh.slug);
          return (
            <ShlokaListItem
              key={sh.slug}
              slug={sh.slug}
              title={sh.title}
              sanskritFirstLine={sh.lines?.[0]?.sanskrit}
              done={!!c}
              rank={c?.rank}
              completedAt={c?.completedAt}
              lineCount={sh.lines?.length}
              index={i + 1}
            />
          );
        })}
      </div>
    </div>
  );
}
```

If the home directory used a `.jsx` file before, delete the `.jsx` and create `.tsx`:

```bash
rm "src/app/(student)/home/home.jsx" 2>/dev/null || true
```

And confirm `src/app/(student)/home/page.tsx` imports the new file:

```tsx
import Home from "./home";
export default function Page() { return <Home />; }
```

- [ ] **Step 5: tsc check + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/(student)/home" src/components/student/ShlokaListItem.tsx src/components/student/StatsBanner.tsx
git commit -m "feat(mobile): home page rewrite + ShlokaListItem + StatsBanner"
```

---

## Task 10: Frontend — Deprecate `/dashboard`

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Delete: `src/app/dashboard/Dashboard.jsx`, `src/app/dashboard/components/`

- [ ] **Step 1: Replace dashboard/page.tsx with redirect**

```tsx
import { redirect } from "next/navigation";

export default function DashboardRedirect() {
  redirect("/home");
}
```

- [ ] **Step 2: Delete the obsolete files**

```bash
git rm src/app/dashboard/Dashboard.jsx
git rm -r src/app/dashboard/components/
# layout.tsx (if any) — keep only if it doesn't break the redirect; otherwise remove:
[ -f src/app/dashboard/layout.tsx ] && git rm src/app/dashboard/layout.tsx
```

- [ ] **Step 3: Build smoke + commit**

```bash
npm run build 2>&1 | tail -10
git add src/app/dashboard/page.tsx
git commit -m "feat(mobile): deprecate /dashboard — redirect to /home"
```

---

## Task 11: Frontend — `/my-shlokas` page

**Files:**
- Create: `src/app/(student)/my-shlokas/page.tsx`
- Create: `src/app/(student)/my-shlokas/MyShlokas.tsx`

- [ ] **Step 1: Write `page.tsx`**

Create `src/app/(student)/my-shlokas/page.tsx`:

```tsx
import MyShlokas from "./MyShlokas";

export default function Page() {
  return <MyShlokas />;
}
```

- [ ] **Step 2: Write `MyShlokas.tsx`**

```tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import TopBar from "@/components/student/TopBar";
import AvatarCircle from "@/components/student/AvatarCircle";
import type { MyCompletionRow, ApiError } from "@/lib/auth/types";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function mmss(s: number): string {
  if (!isFinite(s) || s < 0) return "—";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

type Filter = "all" | "top5" | "recent";

export default function MyShlokas() {
  const { state: authState } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;
  const [items, setItems] = useState<MyCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    api.me
      .completions()
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const best = useMemo(() => {
    if (items.length === 0) return null;
    return [...items].sort((a, b) => a.rank - b.rank)[0];
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "top5") return items.filter((i) => i.rank <= 5);
    if (filter === "recent") {
      const sevenDays = 86400 * 7 * 1000;
      return items.filter((i) => Date.now() - new Date(i.completedAt).getTime() < sevenDays);
    }
    return items;
  }, [items, filter]);

  const chip = (k: Filter, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setFilter(k)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        filter === k
          ? "bg-accent text-white"
          : "bg-white border border-[#E5DDD0] text-brown"
      }`}
    >
      {label} ({count})
    </button>
  );

  const allCount = items.length;
  const top5Count = items.filter((i) => i.rank <= 5).length;
  const recentCount = items.filter(
    (i) => Date.now() - new Date(i.completedAt).getTime() < 86400 * 7 * 1000
  ).length;

  return (
    <div>
      <TopBar
        subtitle="Your library"
        title="My Shlokas"
        trailing={me ? <AvatarCircle name={me.name} email={me.email} size={34} /> : null}
      />
      <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
        <div className="flex gap-2 flex-wrap">
          {chip("all", "All", allCount)}
          {chip("top5", "Top 5", top5Count)}
          {chip("recent", "Recent", recentCount)}
        </div>

        {best && (
          <div className="bg-accent-soft border border-accent rounded-xl p-3 flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🏆</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-500">Your best rank</div>
              <div className="text-sm font-bold text-brown truncate">#{best.rank} on {best.title}</div>
            </div>
          </div>
        )}

        <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
          Completed shlokas
        </div>

        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <div className="text-center text-xs text-gray-500 italic p-4 bg-white border border-dashed border-[#E5DDD0] rounded-lg">
            📚 Complete shlokas to fill your library
          </div>
        )}

        {!loading && !error && items.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-gray-500 italic">No shlokas match this filter.</p>
        )}

        {!loading && !error && filtered.map((row) => (
          <Link
            key={row.shlokaId}
            href={`/shloka/${encodeURIComponent(row.slug)}`}
            className="bg-white border border-[#E5DDD0] rounded-xl p-3 flex gap-3 items-center hover:bg-white/80 transition"
          >
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "linear-gradient(135deg,#7BA77B,#A5D6A7)" }}
              aria-hidden="true"
            >
              ✓
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-brown truncate">{row.title}</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                #{row.rank} · {row.attempts} attempt{row.attempts === 1 ? "" : "s"} · {mmss(row.elapsedSeconds)} · {timeAgo(row.completedAt)}
              </div>
            </div>
            {row.rank === 1 ? (
              <span className="text-accent text-base" aria-hidden="true">★</span>
            ) : (
              <span className="text-gray-400" aria-hidden="true">›</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: tsc + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(student)/my-shlokas"
git commit -m "feat(mobile): /my-shlokas page with filter chips + best-rank banner"
```

---

## Task 12: Frontend — `/me` page

**Files:**
- Create: `src/app/(student)/me/page.tsx`
- Create: `src/app/(student)/me/Me.tsx`

- [ ] **Step 1: Write `page.tsx`**

```tsx
import Me from "./Me";

export default function Page() {
  return <Me />;
}
```

- [ ] **Step 2: Write `Me.tsx`**

```tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthContext";
import TopBar from "@/components/student/TopBar";
import AvatarCircle from "@/components/student/AvatarCircle";
import type { MyCompletionRow, ApiError } from "@/lib/auth/types";

export default function Me() {
  const router = useRouter();
  const { state: authState, logout } = useAuth();
  const me = authState.status === "authed" ? authState.user : null;
  const [completions, setCompletions] = useState<MyCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.me
      .completions()
      .then((res) => {
        if (!cancelled) setCompletions(res.items);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || "Failed to load stats");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const totalAttempts = completions.reduce((sum, c) => sum + c.attempts, 0);
    const bestRank = completions.length === 0
      ? null
      : completions.reduce((m, c) => (m === null || c.rank < m ? c.rank : m), null as number | null);
    return {
      completed: completions.length,
      attempts: totalAttempts,
      bestRank: bestRank === null ? "—" : `#${bestRank}`,
    };
  }, [completions]);

  const joinedDate = me
    ? new Date(me.createdAt || Date.now()).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "—";

  if (!me) {
    return <p className="p-6 text-sm text-gray-500">Not signed in.</p>;
  }

  return (
    <div>
      <TopBar
        subtitle="Your profile"
        title="Me"
        trailing={<span className="text-xl" aria-hidden="true">⚙️</span>}
      />
      <div className="px-4 py-4 flex flex-col gap-3 max-w-md mx-auto">
        {/* Avatar block */}
        <div className="bg-white border border-[#E5DDD0] rounded-2xl p-5 text-center">
          <div className="flex justify-center">
            <AvatarCircle name={me.name} email={me.email} size={72} />
          </div>
          <div className="text-base font-bold text-brown mt-3">{me.name}</div>
          <div className="text-xs text-gray-500 mt-1">{me.email}</div>
        </div>

        {/* Info card */}
        <div className="bg-white border border-[#E5DDD0] rounded-xl overflow-hidden">
          <Row label="College" value={(me as { collegeName?: string }).collegeName ?? "—"} />
          <Row label="Course" value={(me as { course?: string }).course ?? "—"} />
          <Row label="Joined" value={joinedDate} last />
        </div>

        {/* Stats card */}
        <div className="bg-white border border-[#E5DDD0] rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Your stats</div>
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && (
            <div className="flex justify-around text-center">
              <div>
                <div className="text-lg font-bold text-brown">{stats.completed}</div>
                <div className="text-[10px] text-gray-500">Completed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-brown">{stats.attempts}</div>
                <div className="text-[10px] text-gray-500">Attempts</div>
              </div>
              <div>
                <div className="text-lg font-bold text-accent">{stats.bestRank}</div>
                <div className="text-[10px] text-gray-500">Best rank</div>
              </div>
            </div>
          )}
        </div>

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
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 ${last ? "" : "border-b border-[#F0E7D8]"}`}
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-brown text-right max-w-[180px] truncate">{value}</span>
    </div>
  );
}
```

If `PublicUser` type doesn't yet include `collegeName` or `course`, the type assertion `(me as { collegeName?: string })` allows fallback to "—". Ideally extend the type — but if it's already there from earlier work, the assertion is harmless.

If `useAuth().logout` returns void or different signature, adapt the `await logout()` call accordingly.

- [ ] **Step 3: tsc + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(student)/me"
git commit -m "feat(mobile): /me page with avatar + info + stats + logout"
```

---

## Task 13: Frontend — MiniPlayer component

**Files:**
- Create: `src/components/student/MiniPlayer.tsx`

This extracts the sticky-bottom player UI from `ShlokaDesc.jsx`. The component is purely presentational — it takes props and renders buttons; the parent owns all player state via the existing `useShlokaPlayer` hook.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import React from "react";

interface Props {
  /** Current line number (1-indexed) */
  currentLine: number;
  /** Total lines */
  totalLines: number;
  /** Current repetition (1-indexed) */
  rep: number;
  /** Max repetitions */
  maxReps: number;
  /** "playing" | "paused" | "idle" | "done" — controls main button icon/label */
  status: "playing" | "paused" | "idle" | "done";
  /** Progress 0..1 within the current rep */
  progress: number;
  /** Elapsed seconds within current rep (for display) */
  elapsedSec?: number;
  /** Total seconds of current rep (for display) */
  totalSec?: number;
  /** Whether Sanskrit is hidden (Hide button toggle) */
  hidden?: boolean;
  onPlayPause: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onToggleHide?: () => void;
}

function mmss(s?: number): string {
  if (s === undefined || !isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

const MiniPlayer: React.FC<Props> = ({
  currentLine, totalLines, rep, maxReps, status, progress, elapsedSec, totalSec, hidden,
  onPlayPause, onSkipPrev, onSkipNext, onToggleHide,
}) => {
  const mainIcon = status === "playing" ? "⏸" : "▶";
  const mainLabel = status === "playing" ? "Pause" : status === "paused" ? "Resume" : status === "done" ? "Replay" : "Play";

  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 bg-accent-soft border-t border-accent z-30 anim-player-slide-up">
      <div className="max-w-md mx-auto px-3 py-2">
        <div className="flex items-center justify-between text-[10px] font-semibold text-brown mb-1.5">
          <span>Line {currentLine} · Rep {rep}/{maxReps}</span>
          <span className="text-gray-500">{mmss(elapsedSec)} / {mmss(totalSec)}</span>
        </div>
        <div className="bg-[#E5DDD0] rounded h-1 overflow-hidden mb-2">
          <div className="bg-accent h-full transition-all" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
        </div>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={onSkipPrev} className="touch-target rounded-full bg-white border border-[#E5DDD0] text-brown" aria-label="Skip previous line">
            <span aria-hidden="true">⏮</span>
          </button>
          <button type="button" onClick={onPlayPause} className="touch-target rounded-full bg-accent text-white text-lg" aria-label={mainLabel} title={mainLabel}>
            <span aria-hidden="true">{mainIcon}</span>
          </button>
          <button type="button" onClick={onSkipNext} className="touch-target rounded-full bg-white border border-[#E5DDD0] text-brown" aria-label="Skip next line">
            <span aria-hidden="true">⏭</span>
          </button>
          {onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className={`touch-target rounded-full border text-brown ${hidden ? "bg-accent text-white border-accent" : "bg-white border-[#E5DDD0]"}`}
              aria-label={hidden ? "Show Sanskrit" : "Hide Sanskrit"}
              title={hidden ? "Show Sanskrit" : "Hide Sanskrit"}
            >
              <span aria-hidden="true">🙈</span>
            </button>
          )}
        </div>
        <div className="text-center text-[9px] text-gray-500 mt-0.5">
          {currentLine} of {totalLines}
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add src/components/student/MiniPlayer.tsx
git commit -m "feat(mobile): MiniPlayer component with full controls + progress"
```

---

## Task 14: Frontend — ShlokaDisplay mobile tweaks

**Files:**
- Modify: `src/app/(student)/shloka/[slug]/ShlokaDisplay.jsx`

- [ ] **Step 1: Update font sizes**

In the existing file, change the line:

```jsx
isActive
  ? "text-2xl px-4 bg-primary-light-1 w-full"
  : "text-2xl px-4 w-full opacity-40"
```

to use responsive sizes (mobile-first):

```jsx
isActive
  ? "text-lg md:text-2xl px-4 bg-primary-light-1 w-full leading-relaxed"
  : "text-sm md:text-2xl px-4 w-full opacity-40 leading-relaxed"
```

This keeps desktop at `text-2xl` but uses `text-lg` (18px) on mobile for the active line + `text-sm` (14px) for inactive — much more readable on a 375 px phone.

- [ ] **Step 2: Tighten the wrapper padding**

Change the outer wrapper from `p-3` to `p-2 md:p-3` so mobile breathes a bit less:

```jsx
return (
  <div className="bg-white p-2 md:p-3 text-center place-items-center space-y-2 w-full">
    ...
  </div>
);
```

- [ ] **Step 3: tsc check + commit**

```bash
npx tsc --noEmit
git add "src/app/(student)/shloka/[slug]/ShlokaDisplay.jsx"
git commit -m "feat(mobile): ShlokaDisplay responsive font sizes for mobile"
```

---

## Task 15: Frontend — Leaderboard compact rows

**Files:**
- Modify: `src/app/(student)/shloka/[slug]/Leaderboard.tsx`

- [ ] **Step 1: Tighten the row markup**

Find the existing `<li>` markup. Change:
- The avatar size class `w-9 h-9` → `w-8 h-8 md:w-9 md:h-9`
- The container padding from `p-4` → `p-3 md:p-4` on the outer wrapper
- The row padding from `p-2` → `p-1.5 md:p-2`
- Font sizes already `text-sm` and `text-xs` — those are fine.

Specifically, in the row's avatar `<span>`, change `w-9 h-9` to `w-8 h-8 md:w-9 md:h-9`.

In the outermost wrapper `<div className="bg-white/60 rounded-lg p-4 mt-6">`, change `p-4` to `p-3 md:p-4` and `mt-6` to `mt-4 md:mt-6`.

In each row `<li>`, change `p-2` to `p-1.5 md:p-2`.

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add "src/app/(student)/shloka/[slug]/Leaderboard.tsx"
git commit -m "feat(mobile): Leaderboard tighter rows + smaller avatars"
```

---

## Task 16: Frontend — Shloka detail page rewrite (sticky player + accordions)

**Files:**
- Modify: `src/app/(student)/shloka/[slug]/ShlokaDesc.jsx`

This is the biggest visual change. The existing `ShlokaDesc.jsx` uses a 2-column grid (`md:grid-cols-6`); we rewrite it into a mobile-first single-column stack with a sticky `<MiniPlayer />`, collapsible meaning/translation, and an accordion-collapsed leaderboard.

- [ ] **Step 1: Read current ShlokaDesc.jsx to confirm player hook surface**

```bash
cat "src/app/(student)/shloka/[slug]/ShlokaDesc.jsx"
```

Confirm what `useShlokaPlayer` returns: at minimum `state`, `currentLine`, `currentWordIndex`, `rep`, `REPETITIONS`, `audioRef`, `currentSrc`, `play`, `pause`, `resume`, `skipPrev`, `skipNext`, `isPlaying`. If a `progress` value isn't exposed, derive it from the audio element via a separate `useEffect` in this file (see Step 2).

- [ ] **Step 2: Replace the file**

Overwrite `src/app/(student)/shloka/[slug]/ShlokaDesc.jsx` with:

```jsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import ShlokaDisplay from "./ShlokaDisplay";
import Leaderboard from "./Leaderboard";
import { useShlokaPlayer } from "./hooks/useShlokaPlayer";
import { useCompletionTracker } from "./hooks/useCompletionTracker";
import { useAuth } from "@/lib/auth/AuthContext";
import TopBar from "@/components/student/TopBar";
import MiniPlayer from "@/components/student/MiniPlayer";

const ShlokaDesc = ({ shloka }) => {
  const router = useRouter();
  const player = useShlokaPlayer(shloka);
  const { state: authState } = useAuth();
  const currentUserId = authState.status === "authed" ? authState.user.id : undefined;
  const tracker = useCompletionTracker(shloka.slug, player.state);

  const [hideSanskrit, setHideSanskrit] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);

  // Derive current rep audio progress (0..1) + elapsed/total seconds
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const audio = player.audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setElapsed(audio.currentTime || 0);
      setTotal(audio.duration || 0);
      setProgress(audio.duration ? (audio.currentTime || 0) / audio.duration : 0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
    };
  }, [player.audioRef, player.currentSrc]);

  // Map player.state.status → MiniPlayer status prop
  const miniStatus =
    player.state.status === "PAUSED" ? "paused" :
    player.state.status === "IDLE" ? "idle" :
    player.state.status === "DONE" ? "done" : "playing";

  const handlePlayPause = () => {
    if (player.state.status === "IDLE" || player.state.status === "DONE") {
      player.play();
    } else if (player.state.status === "PAUSED") {
      player.resume();
    } else {
      player.pause();
    }
  };

  const playingFull =
    player.state.status === "PLAYING_FULL" ||
    (player.state.status === "PAUSING_REP" && player.state.mode === "FULL") ||
    player.state.status === "PAUSING_FULL" ||
    (player.state.status === "PAUSED" &&
      (player.state.prev.status === "PLAYING_FULL" ||
        player.state.prev.status === "PAUSING_FULL" ||
        (player.state.prev.status === "PAUSING_REP" && player.state.prev.mode === "FULL")));

  return (
    <div>
      <TopBar
        title={shloka.title}
        showBack
        trailing={
          <button
            type="button"
            onClick={() => { /* TODO: favorite toggle (deferred) */ }}
            className="touch-target"
            aria-label="Favorite"
          >
            <Heart size={20} />
          </button>
        }
      />

      {/* Body padded to clear sticky mini-player (86px) + safe area */}
      <div className="px-4 py-3 flex flex-col gap-3 max-w-md mx-auto pb-[110px]">
        {/* Hero */}
        <div className="relative h-32 rounded-2xl overflow-hidden">
          <Image
            src="/images/shloka_img_2.jpg"
            alt=""
            fill
            className="object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h1 className="text-base font-bold leading-tight">{shloka.title}</h1>
            <p className="text-[10px] opacity-90 mt-1">
              Guiding the Early Healing of Fever through Detox and Lightness
            </p>
          </div>
        </div>

        {/* Sanskrit display */}
        {!hideSanskrit && (
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-3">
            <ShlokaDisplay
              shloka={shloka}
              activeLine={Math.max(0, player.currentLine)}
              currentWordIndex={player.currentWordIndex}
              rep={player.rep}
              maxReps={player.REPETITIONS}
              playingFull={playingFull}
            />
          </div>
        )}
        {hideSanskrit && (
          <div className="bg-white border border-dashed border-[#E5DDD0] rounded-2xl p-4 text-center text-sm text-gray-500 italic">
            Sanskrit hidden — practice from memory. Tap 🙈 again to show.
          </div>
        )}

        {/* Meaning + Translation (collapsible) */}
        <details className="bg-white border border-[#E5DDD0] rounded-xl" open>
          <summary className="px-3 py-2.5 text-sm font-bold text-brown cursor-pointer list-none flex items-center justify-between">
            <span>📖 Meaning &amp; Translation</span>
            <span className="text-gray-400 text-xs">▲</span>
          </summary>
          <div className="px-3 pb-3 text-xs text-brown leading-relaxed">
            <p className="italic mb-2">{shloka.translation}</p>
            <p>{shloka.meaning}</p>
          </div>
        </details>

        {/* Lines summary */}
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Lines</div>
        {shloka.lines.map((line, i) => {
          const isCurrent = i === player.currentLine && player.state.status !== "IDLE" && player.state.status !== "DONE";
          const isDone = i < player.currentLine;
          return (
            <div
              key={i}
              className={`rounded-xl p-2.5 border ${
                isCurrent
                  ? "bg-accent-soft border-accent shadow-[0_0_0_2px_rgba(212,165,116,0.25)]"
                  : isDone
                  ? "bg-white border-[#E5DDD0] opacity-60"
                  : "bg-white border-[#E5DDD0]"
              }`}
            >
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span aria-hidden="true">{isDone ? "✓" : isCurrent ? "●" : "○"}</span>
                <span className={isCurrent ? "text-accent font-bold" : ""}>
                  Line {i + 1}{isCurrent ? ` · playing` : isDone ? ` · done` : ""}
                </span>
                {isCurrent && (
                  <span className="ml-auto">{player.rep}/{player.REPETITIONS} reps</span>
                )}
              </div>
              <div className="text-xs text-brown mt-1">{line.sanskrit}</div>
            </div>
          );
        })}

        {/* Completion banner */}
        {tracker.submitted && (
          <div className="mt-1 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            {tracker.alreadyCompleted
              ? "You completed this earlier 🎉"
              : "🎉 You completed it! Check the leaderboard below."}
          </div>
        )}

        {/* Leaderboard accordion */}
        <details
          className="bg-white border border-[#E5DDD0] rounded-xl"
          open={lbOpen}
          onToggle={(e) => setLbOpen(e.currentTarget.open)}
        >
          <summary className="px-3 py-2.5 text-sm font-bold text-brown cursor-pointer list-none flex items-center justify-between">
            <span>🏆 Leaderboard</span>
            <span className="text-gray-400 text-xs">{lbOpen ? "▲" : "▼"}</span>
          </summary>
          <div className="px-1 pb-1">
            <Leaderboard
              slug={shloka.slug}
              currentUserId={currentUserId}
              refreshKey={tracker.completionVersion}
            />
          </div>
        </details>
      </div>

      {/* Hidden audio element driven by hook */}
      <audio ref={player.audioRef} src={player.currentSrc ?? undefined} />

      {/* Sticky mini-player */}
      <MiniPlayer
        currentLine={Math.max(1, player.currentLine + 1)}
        totalLines={shloka.lines.length}
        rep={player.rep || 1}
        maxReps={player.REPETITIONS}
        status={miniStatus}
        progress={progress}
        elapsedSec={elapsed}
        totalSec={total}
        hidden={hideSanskrit}
        onPlayPause={handlePlayPause}
        onSkipPrev={player.skipPrev}
        onSkipNext={player.skipNext}
        onToggleHide={() => setHideSanskrit((v) => !v)}
      />
    </div>
  );
};

export default ShlokaDesc;
```

- [ ] **Step 3: tsc + build smoke**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

If build fails because `MiniPlayer` props don't match (e.g., the parent passes a value that doesn't match the prop type), fix the call site. The MiniPlayer interface is defined in Task 13.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(student)/shloka/[slug]/ShlokaDesc.jsx"
git commit -m "feat(mobile): shloka detail mobile-first with sticky MiniPlayer + accordions"
```

---

## Task 17: Frontend — Final build + lint + tsc verification

**Files:** none (verification only)

- [ ] **Step 1: Run all checks**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
npx tsc --noEmit 2>&1 | tail -20
npm run lint 2>&1 | tail -20
npm run build 2>&1 | tail -25
```

Expected: all clean.

- [ ] **Step 2: If anything fails, fix it inline**

Most likely issues:
- Unused imports → remove them
- Type mismatches in MiniPlayer props → fix call site
- Missing `collegeName` / `course` in `PublicUser` → extend the type in `src/lib/auth/types.ts`

Re-run after fixes. Do NOT skip this gate.

- [ ] **Step 3: Commit any fix-ups**

```bash
git add -A
git commit -m "fix(mobile): final tsc/lint cleanup" --allow-empty
```

(`--allow-empty` keeps the step idempotent if nothing needed fixing.)

---

## Task 18: Push + manual QA

**Files:** none

- [ ] **Step 1: Push backend**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend
git push origin main
```

- [ ] **Step 2: Push frontend**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani
git push origin main
```

- [ ] **Step 3: Wait ~3 minutes for Render redeploys (backend + frontend)**

- [ ] **Step 4: Manual QA on iPhone Safari + Android Chrome**

| # | Action | Expected |
|---|---|---|
| 1 | Open `/` on mobile, unauthed | Landing hero + 3 feature cards + Get started / Sign in CTAs |
| 2 | Sign up new student | Form fields stack vertically, course dropdown shows "3rd Prof BAMS" pre-selected. After submit → /home |
| 3 | View /home | Welcome + name, stats banner (0 / N / 0%), search input, list of shlokas |
| 4 | Tap a shloka | /shloka/[slug] opens with top bar (back + title + heart), hero, Sanskrit display, meaning section expanded, lines list, leaderboard collapsed, sticky mini-player at bottom |
| 5 | Tap Play in mini-player | Audio starts, mini-player shows ⏸ icon, line cards update, current word highlights yellow, status pill increments reps |
| 6 | Tap Skip-next | Player advances to next line |
| 7 | Tap Skip-prev | Player rewinds to previous line |
| 8 | Tap Hide (🙈) | Sanskrit card replaced with "Sanskrit hidden — practice from memory" message; mini-player button now amber-filled. Tap again → restored. |
| 9 | Let playback finish all lines + full reps | Completion banner appears: "🎉 You completed it!" + leaderboard refreshes |
| 10 | Tab bar tap → 📚 My | Navigates to /my-shlokas; the just-completed shloka shows with rank + attempts + time |
| 11 | Filter chips on /my-shlokas | "Top 5" filters to rank ≤5; "Recent" filters to last 7 days; "All" shows everything |
| 12 | Tab bar tap → 👤 Me | Shows large avatar circle, name + email, College/Course/Joined card, stats card with Completed/Attempts/Best rank, Edit (disabled), Log out |
| 13 | Tap Log out | Returns to /login |
| 14 | Sign in as existing student | /home loads as expected |
| 15 | Tap browser back from /shloka/[slug] | Returns to previous page (Home or My); audio stops |
| 16 | Rotate phone | No horizontal scroll on any page |
| 17 | iPhone X+: bottom area | Tab bar respects safe-area-inset-bottom (doesn't sit on home indicator) |
| 18 | Old /dashboard URL | Redirects to /home |

- [ ] **Step 5: Report findings**

If any failure: paste the page + symptom here.

---

## Verification Checklist

- [ ] Backend: 4 new tests pass, full suite ~103 green
- [ ] Backend: `npx tsc --noEmit` clean
- [ ] Frontend: `npx tsc --noEmit` clean
- [ ] Frontend: `npm run lint` clean
- [ ] Frontend: `npm run build` succeeds
- [ ] Manual QA (Task 18) passes on real iPhone Safari + Android Chrome
- [ ] No regressions on desktop ≥768 px (pages still usable; just narrower)
- [ ] `/dashboard` redirects to `/home`
