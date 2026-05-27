# Shloka Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add per-shloka leaderboard. Backend `ShlokaCompletion` model + `POST /complete` + `GET /leaderboard` endpoints (with composite ranking). Frontend records completion when audio playback hits DONE, renders leaderboard + completion banner.

**Architecture:** New Mongo collection `shlokacompletions` (unique on user+shloka). Backend mounts `/api/shlokas/:slug/completions/*`-style routes. Frontend hooks into existing `useShlokaPlayer.state.status === 'DONE'` to fire POST; new `Leaderboard` component fetches + renders.

**Tech Stack:** Existing Node/Express/Mongoose + Next.js 15/React 19. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-25-shloka-leaderboard-design.md`

---

## File Structure

**Backend (`shloka-backend/`):**
- Create: `src/models/ShlokaCompletion.ts`
- Create: `src/lib/avatar.ts`
- Create: `src/routes/completions.ts`
- Modify: `src/server.ts`
- Create: `tests/completions.integration.test.ts`

**Frontend (`kayachikitsasutrani/`):**
- Modify: `src/lib/auth/types.ts`
- Modify: `src/lib/api.ts`
- Create: `src/app/shloka/[slug]/hooks/useCompletionTracker.ts`
- Create: `src/app/shloka/[slug]/Leaderboard.tsx`
- Modify: `src/app/shloka/[slug]/ShlokaDesc.jsx`

---

## Task 1: Backend — ShlokaCompletion model + avatar helper

**Files:**
- Create: `src/models/ShlokaCompletion.ts`
- Create: `src/lib/avatar.ts`

- [ ] **Step 1: Write `ShlokaCompletion.ts`**

```ts
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const shlokaCompletionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shlokaId: { type: Schema.Types.ObjectId, ref: 'Shloka', required: true },
    completedAt: { type: Date, required: true },
    attempts: { type: Number, required: true, min: 1, max: 1000 },
    elapsedSeconds: { type: Number, required: true, min: 0, max: 86400 },
  },
  { timestamps: true },
);

shlokaCompletionSchema.index({ userId: 1, shlokaId: 1 }, { unique: true });
shlokaCompletionSchema.index({ shlokaId: 1, completedAt: 1 });

export type ShlokaCompletionDoc = HydratedDocument<InferSchemaType<typeof shlokaCompletionSchema>>;
export const ShlokaCompletion = model('ShlokaCompletion', shlokaCompletionSchema);
```

- [ ] **Step 2: Write `avatar.ts`**

```ts
export function deriveAvatar(name: string, email: string): { initials: string; color: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts.length === 0
    ? "?"
    : parts.length === 1
      ? parts[0].slice(0, 2)
      : parts[0][0] + parts[parts.length - 1][0]
  ).toUpperCase();
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return { initials, color: `hsl(${h}, 55%, 65%)` };
}
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/models/ShlokaCompletion.ts src/lib/avatar.ts
git commit -m "feat: ShlokaCompletion model + avatar helper"
```

---

## Task 2: Backend — completions routes with ranking

**Files:**
- Create: `src/routes/completions.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write `completions.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Shloka } from '../models/Shloka.js';
import { ShlokaCompletion, type ShlokaCompletionDoc } from '../models/ShlokaCompletion.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { deriveAvatar } from '../lib/avatar.js';

export const completionsRouter = Router();

completionsRouter.use(requireAuth);

const completeBodySchema = z.object({
  attempts: z.number().int().min(1).max(1000),
  elapsedSeconds: z.number().min(0).max(86400),
});

/** Resolve a slug to a shloka the user is allowed to see (drafts admin-only). */
async function findVisibleShloka(slug: string, userRole: 'student' | 'admin') {
  const doc = await Shloka.findOne({ slug });
  if (!doc) return null;
  if (doc.status === 'draft' && userRole !== 'admin') return null;
  return doc;
}

completionsRouter.post('/:slug/complete', async (req, res, next) => {
  try {
    const body = completeBodySchema.parse(req.body);
    const shloka = await findVisibleShloka(req.params.slug, req.user!.role);
    if (!shloka) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }
    const userId = new Types.ObjectId(req.user!.id);
    const existing = await ShlokaCompletion.findOne({ userId, shlokaId: shloka._id });
    if (existing) {
      res.json({
        completion: {
          id: existing._id.toString(),
          userId: existing.userId.toString(),
          shlokaId: existing.shlokaId.toString(),
          completedAt: (existing.completedAt as Date).toISOString(),
          attempts: existing.attempts,
          elapsedSeconds: existing.elapsedSeconds,
        },
        alreadyCompleted: true,
      });
      return;
    }
    const doc = await ShlokaCompletion.create({
      userId,
      shlokaId: shloka._id,
      completedAt: new Date(),
      attempts: body.attempts,
      elapsedSeconds: body.elapsedSeconds,
    });
    res.json({
      completion: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        shlokaId: doc.shlokaId.toString(),
        completedAt: (doc.completedAt as Date).toISOString(),
        attempts: doc.attempts,
        elapsedSeconds: doc.elapsedSeconds,
      },
      alreadyCompleted: false,
    });
  } catch (err) {
    next(err);
  }
});

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

completionsRouter.get('/:slug/leaderboard', async (req, res, next) => {
  try {
    const shloka = await findVisibleShloka(req.params.slug, req.user!.role);
    if (!shloka) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }
    const completions = await ShlokaCompletion.find({ shlokaId: shloka._id }).lean();
    const total = completions.length;
    if (total === 0) {
      res.json({ total: 0, items: [] });
      return;
    }
    // Compute three rank maps using dense ranking
    const chronoRanks = denseRank(completions, (a, b) =>
      (a.completedAt as Date).getTime() - (b.completedAt as Date).getTime(),
    );
    const timeRanks = denseRank(completions, (a, b) => a.elapsedSeconds - b.elapsedSeconds);
    const attemptsRanks = denseRank(completions, (a, b) => a.attempts - b.attempts);

    // Fetch user info for all completions in one query
    const userIds = completions.map((c) => c.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const items = completions.map((c) => {
      const user = userMap.get(c.userId.toString());
      const name = user?.name ?? 'Unknown';
      const email = user?.email ?? '';
      const { initials, color } = deriveAvatar(name, email);
      const chronoRank = chronoRanks.get(c)!;
      const timeRank = timeRanks.get(c)!;
      const attemptsRank = attemptsRanks.get(c)!;
      return {
        userId: c.userId.toString(),
        name,
        email,
        avatarColor: color,
        initials,
        completedAt: (c.completedAt as Date).toISOString(),
        attempts: c.attempts,
        elapsedSeconds: c.elapsedSeconds,
        chronoRank,
        timeRank,
        attemptsRank,
        averageRank: (chronoRank + timeRank + attemptsRank) / 3,
      };
    });

    items.sort((a, b) => {
      if (a.averageRank !== b.averageRank) return a.averageRank - b.averageRank;
      return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    });

    res.json({ total, items });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Mount router in `server.ts`**

Find the existing imports for routes and add:

```ts
import { completionsRouter } from './routes/completions.js';
```

In `buildApp`, near the existing `/api/shlokas` mount, add:

```ts
  app.use('/api/shlokas', completionsRouter);
```

(Mount under `/api/shlokas` so the routes resolve to `/api/shlokas/:slug/complete` and `/api/shlokas/:slug/leaderboard`. Order doesn't matter — express tries each router for matching routes.)

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/routes/completions.ts src/server.ts
git commit -m "feat: completion + leaderboard routes with composite ranking"
```

---

## Task 3: Backend — integration tests

**Files:**
- Create: `tests/completions.integration.test.ts`

- [ ] **Step 1: Write the test file**

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

async function seedShloka(slug: string, status: 'draft' | 'published' = 'published') {
  const u = await User.create({
    email: `creator-${slug}@x.test`,
    passwordHash: 'x',
    role: 'admin',
    name: 'Creator',
  });
  return Shloka.create({
    slug,
    title: slug,
    meaning: 'm',
    translation: 't',
    status,
    audio: { full: { url: 'u', publicId: 'p' }, lines: [{ url: 'u', publicId: 'p1' }] },
    lines: [
      {
        sanskrit: 'a',
        words: [{ text: 'a', start: 0, end: 1 }],
        fullTimings: [{ text: 'a', start: 0, end: 1 }],
      },
    ],
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

describe('POST /api/shlokas/:slug/complete', () => {
  it('records first completion', async () => {
    const shloka = await seedShloka('s1');
    const student = await seedStudent('a@x.test', 'Aakash Raj');
    const res = await request(app)
      .post('/api/shlokas/s1/complete')
      .set('Cookie', cookieFor(student._id.toString()))
      .send({ attempts: 1, elapsedSeconds: 42 });
    expect(res.status).toBe(200);
    expect(res.body.alreadyCompleted).toBe(false);
    expect(res.body.completion.attempts).toBe(1);
    expect(res.body.completion.elapsedSeconds).toBe(42);
    const count = await ShlokaCompletion.countDocuments({});
    expect(count).toBe(1);
  });

  it('second POST returns existing, does not update', async () => {
    const shloka = await seedShloka('s1');
    const student = await seedStudent('a@x.test', 'A');
    await request(app).post('/api/shlokas/s1/complete')
      .set('Cookie', cookieFor(student._id.toString()))
      .send({ attempts: 1, elapsedSeconds: 42 });
    const res = await request(app).post('/api/shlokas/s1/complete')
      .set('Cookie', cookieFor(student._id.toString()))
      .send({ attempts: 99, elapsedSeconds: 999 });
    expect(res.status).toBe(200);
    expect(res.body.alreadyCompleted).toBe(true);
    expect(res.body.completion.attempts).toBe(1);
    expect(res.body.completion.elapsedSeconds).toBe(42);
  });

  it('unauth → 401', async () => {
    await seedShloka('s1');
    const res = await request(app).post('/api/shlokas/s1/complete').send({ attempts: 1, elapsedSeconds: 1 });
    expect(res.status).toBe(401);
  });

  it('unknown slug → 404', async () => {
    const student = await seedStudent('a@x.test', 'A');
    const res = await request(app).post('/api/shlokas/none/complete')
      .set('Cookie', cookieFor(student._id.toString()))
      .send({ attempts: 1, elapsedSeconds: 1 });
    expect(res.status).toBe(404);
  });

  it('draft shloka as student → 404', async () => {
    await seedShloka('draft1', 'draft');
    const student = await seedStudent('a@x.test', 'A');
    const res = await request(app).post('/api/shlokas/draft1/complete')
      .set('Cookie', cookieFor(student._id.toString()))
      .send({ attempts: 1, elapsedSeconds: 1 });
    expect(res.status).toBe(404);
  });

  it('invalid body → 400', async () => {
    await seedShloka('s1');
    const student = await seedStudent('a@x.test', 'A');
    const res = await request(app).post('/api/shlokas/s1/complete')
      .set('Cookie', cookieFor(student._id.toString()))
      .send({ attempts: 0, elapsedSeconds: -1 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/shlokas/:slug/leaderboard', () => {
  it('empty when no completions', async () => {
    await seedShloka('s1');
    const student = await seedStudent('a@x.test', 'A');
    const res = await request(app).get('/api/shlokas/s1/leaderboard')
      .set('Cookie', cookieFor(student._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it('ranks by averageRank with correct sub-ranks', async () => {
    const shloka = await seedShloka('s1');
    // Three students with different signatures:
    // A: 1st chrono, 2nd time, 3rd attempts → (1+2+3)/3 = 2
    // B: 2nd chrono, 1st time, 1st attempts → (2+1+1)/3 = 1.33
    // C: 3rd chrono, 3rd time, 2nd attempts → (3+3+2)/3 = 2.67
    // Expected order: B, A, C
    const a = await seedStudent('a@x.test', 'A');
    const b = await seedStudent('b@x.test', 'B');
    const c = await seedStudent('c@x.test', 'C');
    await ShlokaCompletion.create({ userId: a._id, shlokaId: shloka._id, completedAt: new Date('2026-05-25T10:00:00Z'), attempts: 5, elapsedSeconds: 100 });
    await ShlokaCompletion.create({ userId: b._id, shlokaId: shloka._id, completedAt: new Date('2026-05-25T11:00:00Z'), attempts: 1, elapsedSeconds: 50 });
    await ShlokaCompletion.create({ userId: c._id, shlokaId: shloka._id, completedAt: new Date('2026-05-25T12:00:00Z'), attempts: 3, elapsedSeconds: 150 });

    const viewer = await seedStudent('v@x.test', 'V');
    const res = await request(app).get('/api/shlokas/s1/leaderboard')
      .set('Cookie', cookieFor(viewer._id.toString()));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((it: { name: string }) => it.name)).toEqual(['B', 'A', 'C']);
    expect(res.body.items[0].timeRank).toBe(1);
    expect(res.body.items[0].attemptsRank).toBe(1);
    expect(res.body.items[0].chronoRank).toBe(2);
  });

  it('unauth → 401', async () => {
    await seedShloka('s1');
    const res = await request(app).get('/api/shlokas/s1/leaderboard');
    expect(res.status).toBe(401);
  });

  it('draft shloka as student → 404', async () => {
    await seedShloka('d1', 'draft');
    const student = await seedStudent('a@x.test', 'A');
    const res = await request(app).get('/api/shlokas/d1/leaderboard')
      .set('Cookie', cookieFor(student._id.toString()));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
npm test -- completions.integration
```

Expected: 9 tests pass; full suite ~98 tests.

```bash
git add tests/completions.integration.test.ts
git commit -m "test: completion + leaderboard integration tests (9 cases)"
```

---

## Task 4: Frontend — types + api client

**Files:**
- Modify: `src/lib/auth/types.ts` (append)
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Append to `types.ts`**

```ts
// ── Completion + Leaderboard ──────────────────────────────────────────────

export interface CompletionRecord {
  id: string;
  userId: string;
  shlokaId: string;
  completedAt: string;
  attempts: number;
  elapsedSeconds: number;
}

export interface CompleteResponse {
  completion: CompletionRecord;
  alreadyCompleted: boolean;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  initials: string;
  completedAt: string;
  attempts: number;
  elapsedSeconds: number;
  chronoRank: number;
  timeRank: number;
  attemptsRank: number;
  averageRank: number;
}

export interface LeaderboardResponse {
  total: number;
  items: LeaderboardRow[];
}
```

- [ ] **Step 2: Extend `api.shlokas` in `api.ts`**

Find the `shlokas:` block inside the `api` object. Replace it with:

```ts
  shlokas: {
    list: (params?: { limit?: number; cursor?: string }) =>
      request<{ items: PublicShloka[]; nextCursor?: string }>(`/api/shlokas${qs(params)}`),
    get: (slug: string) =>
      request<PublicShloka>(`/api/shlokas/${encodeURIComponent(slug)}`),
    complete: (slug: string, body: { attempts: number; elapsedSeconds: number }) =>
      request<CompleteResponse>(`/api/shlokas/${encodeURIComponent(slug)}/complete`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    leaderboard: (slug: string) =>
      request<LeaderboardResponse>(`/api/shlokas/${encodeURIComponent(slug)}/leaderboard`),
  },
```

Add imports at the top of `api.ts`:

```ts
import type {
  // existing imports …
  CompleteResponse,
  LeaderboardResponse,
} from './auth/types';
```

(Merge into the existing import block.)

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/lib/api.ts src/lib/auth/types.ts
git commit -m "feat: api client + types for completion and leaderboard"
```

---

## Task 5: Frontend — useCompletionTracker hook

**Files:**
- Create: `src/app/shloka/[slug]/hooks/useCompletionTracker.ts`

- [ ] **Step 1: Write the hook**

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PlayerState } from "./playerReducer";

interface Result {
  /** True after a successful POST in this session (either creation or already-completed). */
  submitted: boolean;
  /** True if backend reports this user had already completed earlier. */
  alreadyCompleted: boolean;
  /** Server-reported attempts (from completion record). */
  attempts?: number;
  /** Server-reported elapsedSeconds. */
  elapsedSeconds?: number;
  /** Triggered on successful POST so the leaderboard can refetch. */
  completionVersion: number;
}

/**
 * Watches the player state. Counts attempts (every transition into PLAYING_LINE
 * from IDLE/DONE/PAUSED). On reaching DONE for the first time this session,
 * POSTs the completion to the backend.
 */
export function useCompletionTracker(slug: string | undefined, state: PlayerState): Result {
  const [submitted, setSubmitted] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [attempts, setAttempts] = useState<number | undefined>();
  const [elapsedSeconds, setElapsedSeconds] = useState<number | undefined>();
  const [completionVersion, setCompletionVersion] = useState(0);

  const attemptsRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const prevStatusRef = useRef<PlayerState["status"]>(state.status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = state.status;
    prevStatusRef.current = curr;

    // Count an attempt every time we transition from IDLE/DONE into PLAYING_LINE
    if (curr === "PLAYING_LINE" && (prev === "IDLE" || prev === "DONE" || prev === undefined)) {
      attemptsRef.current += 1;
      if (attemptsRef.current === 1) {
        startedAtRef.current = Date.now();
      }
    }

    // On reaching DONE, submit completion once
    if (curr === "DONE" && !submitted && slug && startedAtRef.current !== null) {
      const elapsed = Math.max(0, (Date.now() - startedAtRef.current) / 1000);
      const att = attemptsRef.current || 1;
      api.shlokas
        .complete(slug, { attempts: att, elapsedSeconds: elapsed })
        .then((res) => {
          setSubmitted(true);
          setAlreadyCompleted(res.alreadyCompleted);
          setAttempts(res.completion.attempts);
          setElapsedSeconds(res.completion.elapsedSeconds);
          setCompletionVersion((v) => v + 1);
        })
        .catch(() => {
          // Swallow — next DONE in this session won't retry. Could add retry later.
        });
    }
  }, [state.status, slug, submitted]);

  return { submitted, alreadyCompleted, attempts, elapsedSeconds, completionVersion };
}
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add "src/app/shloka/[slug]/hooks/useCompletionTracker.ts"
git commit -m "feat: useCompletionTracker hook — posts completion on DONE"
```

---

## Task 6: Frontend — Leaderboard component

**Files:**
- Create: `src/app/shloka/[slug]/Leaderboard.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LeaderboardRow, ApiError } from "@/lib/auth/types";

interface Props {
  slug: string;
  /** Current viewer's user id, to highlight their own row. */
  currentUserId?: string;
  /** Bump this number to force a refetch. */
  refreshKey?: number;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return "yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function formatMmSs(s: number): string {
  if (!isFinite(s) || s < 0) return "—";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

const Leaderboard: React.FC<Props> = ({ slug, currentUserId, refreshKey }) => {
  const [items, setItems] = useState<LeaderboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.shlokas.leaderboard(slug)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || "Could not load leaderboard");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, refreshKey]);

  return (
    <div className="bg-white/60 rounded-lg p-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-brown flex items-center gap-2">
          <span aria-hidden="true">🏆</span>
          Leaderboard
          <span className="text-xs font-normal text-gray-500">({total} completed)</span>
        </h3>
      </div>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && (
        <div className="text-sm">
          <p className="text-red-600">{error}</p>
        </div>
      )}
      {!loading && !error && total === 0 && (
        <p className="text-sm text-gray-500 italic">Be the first to complete this shloka!</p>
      )}
      {!loading && !error && total > 0 && (
        <ol className="space-y-1">
          {items.map((row, idx) => {
            const isMe = row.userId === currentUserId;
            const rank = idx + 1;
            return (
              <li
                key={row.userId}
                className={
                  isMe
                    ? "flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200"
                    : "flex items-center gap-3 p-2 rounded-lg hover:bg-white/80 transition"
                }
              >
                <span className="text-xs text-gray-500 w-8 shrink-0 font-mono">#{rank}</span>
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                  style={{ background: row.avatarColor }}
                  aria-hidden="true"
                >
                  {row.initials}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {row.name}
                    {isMe && <span className="ml-2 text-xs text-amber-700">you</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {timeAgo(row.completedAt)} · {row.attempts} attempt{row.attempts === 1 ? "" : "s"} · {formatMmSs(row.elapsedSeconds)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default Leaderboard;
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add "src/app/shloka/[slug]/Leaderboard.tsx"
git commit -m "feat: Leaderboard component (avatar, ranks, time-ago)"
```

---

## Task 7: Frontend — Wire tracker + leaderboard into ShlokaDesc

**Files:**
- Modify: `src/app/shloka/[slug]/ShlokaDesc.jsx`

- [ ] **Step 1: Read existing file to know structure**

```bash
cat src/app/shloka/[slug]/ShlokaDesc.jsx | head -40
```

Locate the `useShlokaPlayer` call and the return JSX.

- [ ] **Step 2: Add imports + hooks at top**

At the top of the file, after existing imports, add:

```jsx
import Leaderboard from "./Leaderboard";
import { useCompletionTracker } from "./hooks/useCompletionTracker";
import { useAuth } from "@/lib/auth/AuthContext";
```

In the component body, AFTER the existing `const player = useShlokaPlayer(shloka);` line, add:

```jsx
const { state: authState } = useAuth();
const currentUserId = authState.status === "authed" ? authState.user.id : undefined;
const tracker = useCompletionTracker(shloka.slug, player.state);
```

- [ ] **Step 3: Render banner + leaderboard**

Inside the existing JSX return, find the closing `</div>` of the main container (the one wrapping everything below the audio player). RIGHT BEFORE that closing tag, insert:

```jsx
{tracker.submitted && (
  <div className="mt-4 mx-10 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
    {tracker.alreadyCompleted ? (
      <>You completed this earlier 🎉</>
    ) : (
      <>🎉 You completed it! Check the leaderboard below.</>
    )}
  </div>
)}
<div className="mt-4 mx-10">
  <Leaderboard
    slug={shloka.slug}
    currentUserId={currentUserId}
    refreshKey={tracker.completionVersion}
  />
</div>
```

The `mx-10` matches the existing page padding so the leaderboard aligns with content above.

- [ ] **Step 4: tsc + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/shloka/[slug]/ShlokaDesc.jsx"
git commit -m "feat: wire leaderboard + completion tracker into shloka detail page"
```

---

## Task 8: Push + manual QA

**Files:** none

- [ ] **Step 1: Push both repos**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend && git push origin main
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani && git push origin main
```

- [ ] **Step 2: Wait for Render redeploy (~3 min)**

- [ ] **Step 3: Manual QA**

| # | Action | Expected |
|---|---|---|
| 1 | Open a shloka without completing | Leaderboard shows "Be the first to complete this shloka!" |
| 2 | Hit Play, let it run end-to-end | After DONE: green banner "🎉 You completed it!" + leaderboard refreshes with you on it |
| 3 | Reload the page | Leaderboard still shows you; banner gone (tracker resets per session) |
| 4 | Play again, complete again | Banner: "You completed this earlier 🎉" — stats unchanged on backend |
| 5 | Log in as another student, complete the same shloka | Both users appear on leaderboard, ranked by averageRank |
| 6 | Check ranking signals make sense | Earliest + fewest attempts + fastest wins #1 |

- [ ] **Step 4: Report findings**

If anything broken: paste error here.

---

## Verification Checklist

- [ ] Backend: 9 new tests pass, full suite ~98 green
- [ ] Backend: `npm run lint` clean
- [ ] Backend: `npm run build` succeeds
- [ ] Frontend: `npx tsc --noEmit` clean
- [ ] Frontend: `npm run build` succeeds
- [ ] Manual QA (Task 8 step 3) passes
