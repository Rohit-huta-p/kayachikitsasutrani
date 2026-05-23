# Backend Auth + DB Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Node/Express/TS/Mongoose backend at `../shloka-backend/` with JWT cookie auth (signup, login, logout, me, health), seeded admin via CLI, and wire the existing Next.js frontend to it (api client, AuthContext, /login page, Navbar update).

**Architecture:** Two repos: new `shloka-backend` (Express + TS + Mongoose + zod) deployed to Render with MongoDB Atlas; existing Next.js frontend at `kayachikitsasutrani/` consumes it via fetch with `credentials: 'include'` to share httpOnly JWT cookies. Auth state lives in React Context; backend enforces roles via middleware.

**Tech Stack:** Node 20 + Express 4 + TypeScript 5 + Mongoose 8 + zod + bcrypt + jsonwebtoken + helmet + cors + cookie-parser + Vitest + supertest + mongodb-memory-server. Frontend: Next.js 15 + React 19 (existing).

**Spec:** `docs/superpowers/specs/2026-05-23-backend-auth-foundation-design.md`

**Working directories:**
- Backend tasks: `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend/` (will be created in Task 1)
- Frontend tasks: `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani/` (existing)

---

## File Structure

### Backend (`shloka-backend/`)

**Create:**
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`, `render.yaml`, `eslint.config.mjs`
- `src/server.ts` — Express app, middleware chain, port bind
- `src/env.ts` — zod-validated env loader
- `src/db.ts` — Mongoose connect/disconnect
- `src/models/User.ts` — User schema + model
- `src/lib/password.ts` — bcrypt hash/compare
- `src/lib/jwt.ts` — JWT sign/verify
- `src/lib/cookies.ts` — set/clear session cookie
- `src/lib/publicUser.ts` — convert User doc → PublicUser
- `src/middleware/requireAuth.ts`
- `src/middleware/requireRole.ts`
- `src/middleware/errorHandler.ts`
- `src/routes/auth.ts` — signup, login, logout, me
- `src/routes/health.ts` — health check
- `src/scripts/seedAdmin.ts` — CLI seeder
- `src/types/express.d.ts` — augment Express Request with `user`
- Tests: `tests/password.test.ts`, `tests/jwt.test.ts`, `tests/auth.integration.test.ts`, `tests/health.test.ts`, `tests/seedAdmin.test.ts`

### Frontend (`kayachikitsasutrani/`)

**Create:**
- `src/lib/api.ts` — fetch wrapper
- `src/lib/auth/AuthContext.tsx` — provider + hook
- `src/lib/auth/types.ts` — PublicUser, SignupBody, LoginBody
- `src/app/login/page.tsx` — login route
- `src/app/login/Login.tsx` — form component

**Modify:**
- `src/app/layout.tsx` — wrap with `<AuthProvider>`
- `src/app/signup/Signup.tsx` — wire submit handler
- `src/components/Navbar.tsx` — show user / logout when authed
- `.env.local` (create if missing) — `NEXT_PUBLIC_API_URL`

---

## Task 1: Scaffold the Backend Repo

**Files (create new repo):**
- `shloka-backend/package.json`
- `shloka-backend/tsconfig.json`
- `shloka-backend/.gitignore`
- `shloka-backend/.env.example`

- [ ] **Step 1: Create the directory and init git**

Run from `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/`:

```bash
mkdir -p shloka-backend && cd shloka-backend && git init -b main
```

Expected: empty git repo on `main`.

- [ ] **Step 2: Write `package.json`**

Path: `shloka-backend/package.json`. Contents:

```json
{
  "name": "shloka-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "seed:admin": "tsx src/scripts/seedAdmin.ts"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.8.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.17.0",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.13.0",
    "mongodb-memory-server": "^10.1.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.12.2",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

Path: `shloka-backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": false,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Write `.gitignore`**

Path: `shloka-backend/.gitignore`:

```
node_modules
dist
.env
.env.local
coverage
*.log
.DS_Store
```

- [ ] **Step 5: Write `.env.example`**

Path: `shloka-backend/.env.example`:

```
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/shloka
JWT_SECRET=change-me-to-a-random-string-of-at-least-32-chars
FRONTEND_ORIGIN=http://localhost:3000

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-strong-password
ADMIN_NAME=Admin User
```

- [ ] **Step 6: Install deps**

From `shloka-backend/`:

```bash
npm install
```

Expected: completes without errors. `node_modules/` and `package-lock.json` created.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold shloka-backend repo (express, ts, mongoose)"
```

---

## Task 2: Vitest + Lint Config

**Files:**
- Create: `shloka-backend/vitest.config.ts`
- Create: `shloka-backend/eslint.config.mjs`
- Create: `shloka-backend/src/server.ts` (placeholder so build works)
- Create: `shloka-backend/tests/sanity.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

Path: `shloka-backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

- [ ] **Step 2: Write `eslint.config.mjs`**

Path: `shloka-backend/eslint.config.mjs`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

- [ ] **Step 3: Install eslint plugin dep**

```bash
npm install --save-dev @eslint/js
```

- [ ] **Step 4: Placeholder `src/server.ts`**

Path: `shloka-backend/src/server.ts`:

```ts
// placeholder — replaced in Task 7
export {};
```

- [ ] **Step 5: Sanity test**

Path: `shloka-backend/tests/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Verify**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: 1 test passes, tsc clean, lint clean.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: add vitest, eslint config, placeholder entry"
```

---

## Task 3: Env Loader

**Files:**
- Create: `shloka-backend/src/env.ts`
- Create: `shloka-backend/tests/env.test.ts`

- [ ] **Step 1: Write failing test**

Path: `shloka-backend/tests/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseEnv } from '../src/env';

const VALID = {
  NODE_ENV: 'development',
  PORT: '4000',
  MONGO_URI: 'mongodb://localhost:27017/shloka',
  JWT_SECRET: 'a'.repeat(32),
  FRONTEND_ORIGIN: 'http://localhost:3000',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'verystrong',
  ADMIN_NAME: 'Admin',
};

describe('parseEnv', () => {
  it('parses a valid env object', () => {
    const env = parseEnv(VALID);
    expect(env.PORT).toBe(4000);
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.NODE_ENV).toBe('development');
  });

  it('throws on missing MONGO_URI', () => {
    const bad = { ...VALID, MONGO_URI: undefined } as unknown as Record<string, string>;
    expect(() => parseEnv(bad)).toThrow();
  });

  it('throws when JWT_SECRET is too short', () => {
    const bad = { ...VALID, JWT_SECRET: 'short' };
    expect(() => parseEnv(bad)).toThrow();
  });

  it('parses comma-separated FRONTEND_ORIGIN into a list', () => {
    const env = parseEnv({ ...VALID, FRONTEND_ORIGIN: 'http://a.test,http://b.test' });
    expect(env.FRONTEND_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- env
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Path: `shloka-backend/src/env.ts`:

```ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  FRONTEND_ORIGIN: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_NAME: z.string().min(1),
});

export type Env = z.infer<typeof schema> & { FRONTEND_ORIGINS: string[] };

export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>): Env {
  const parsed = schema.parse(source);
  return {
    ...parsed,
    FRONTEND_ORIGINS: parsed.FRONTEND_ORIGIN.split(',').map(s => s.trim()).filter(Boolean),
  };
}

let cached: Env | null = null;
export function env(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env);
  return cached;
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- env
npx tsc --noEmit
```

Expected: 4 tests pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: zod-validated env loader"
```

---

## Task 4: DB Connect

**Files:**
- Create: `shloka-backend/src/db.ts`

This file is exercised indirectly by integration tests (Task 9+). No standalone unit test.

- [ ] **Step 1: Write the file**

Path: `shloka-backend/src/db.ts`:

```ts
import mongoose from 'mongoose';

export async function connectDb(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

export function mongoStateLabel(): 'disconnected' | 'connected' | 'connecting' | 'disconnecting' {
  const s = mongoose.connection.readyState;
  if (s === 1) return 'connected';
  if (s === 2) return 'connecting';
  if (s === 3) return 'disconnecting';
  return 'disconnected';
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/db.ts
git commit -m "feat: mongoose connect/disconnect helpers"
```

---

## Task 5: Password Hashing Lib

**Files:**
- Create: `shloka-backend/src/lib/password.ts`
- Test: `shloka-backend/tests/password.test.ts`

- [ ] **Step 1: Write failing test**

Path: `shloka-backend/tests/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../src/lib/password';

describe('password', () => {
  it('hashes a password to a different string', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).not.toBe('hunter2');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('compare succeeds with correct password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await comparePassword('hunter2', hash)).toBe(true);
  });

  it('compare fails with wrong password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await comparePassword('wrong', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- password
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Path: `shloka-backend/src/lib/password.ts`:

```ts
import bcrypt from 'bcrypt';

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- password
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/password.ts tests/password.test.ts
git commit -m "feat: bcrypt password hash/compare with tests"
```

---

## Task 6: JWT Lib

**Files:**
- Create: `shloka-backend/src/lib/jwt.ts`
- Test: `shloka-backend/tests/jwt.test.ts`

- [ ] **Step 1: Write failing test**

Path: `shloka-backend/tests/jwt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signSession, verifySession } from '../src/lib/jwt';

const SECRET = 'a'.repeat(32);

describe('jwt', () => {
  it('sign and verify round trip', () => {
    const token = signSession('user-123', SECRET);
    const payload = verifySession(token, SECRET);
    expect(payload.sub).toBe('user-123');
  });

  it('rejects token signed with different secret', () => {
    const token = signSession('user-123', SECRET);
    expect(() => verifySession(token, 'b'.repeat(32))).toThrow();
  });

  it('rejects an obviously malformed token', () => {
    expect(() => verifySession('not-a-token', SECRET)).toThrow();
  });

  it('encodes expiry 7 days out', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signSession('user-123', SECRET);
    const payload = verifySession(token, SECRET);
    const sevenDays = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDays - 5);
    expect(payload.exp).toBeLessThanOrEqual(before + sevenDays + 5);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- jwt
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Path: `shloka-backend/src/lib/jwt.ts`:

```ts
import jwt from 'jsonwebtoken';

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

const EXPIRES_IN = '7d';

export function signSession(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { algorithm: 'HS256', expiresIn: EXPIRES_IN });
}

export function verifySession(token: string, secret: string): SessionPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub || typeof decoded.sub !== 'string') {
    throw new Error('Invalid session payload');
  }
  return decoded as SessionPayload;
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- jwt
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jwt.ts tests/jwt.test.ts
git commit -m "feat: JWT sign/verify helpers with tests"
```

---

## Task 7: Cookie Helpers + Express Request Augmentation

**Files:**
- Create: `shloka-backend/src/lib/cookies.ts`
- Create: `shloka-backend/src/types/express.d.ts`

These are small enough to bundle into one task. Tested transitively in Task 11.

- [ ] **Step 1: Write `cookies.ts`**

Path: `shloka-backend/src/lib/cookies.ts`:

```ts
import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'sht_session';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string, isProd: boolean): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, isProd: boolean): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
}
```

- [ ] **Step 2: Write `types/express.d.ts`**

Path: `shloka-backend/src/types/express.d.ts`:

```ts
import type { PublicUser } from '../lib/publicUser';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: error about missing `../lib/publicUser` — that file lands in Task 8. Skip this verification and move on; Task 8 closes the loop.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cookies.ts src/types/express.d.ts
git commit -m "feat: session cookie helpers + Request.user type augmentation"
```

---

## Task 8: User Model + PublicUser Mapper

**Files:**
- Create: `shloka-backend/src/models/User.ts`
- Create: `shloka-backend/src/lib/publicUser.ts`

- [ ] **Step 1: Write `User.ts`**

Path: `shloka-backend/src/models/User.ts`:

```ts
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], required: true, default: 'student' },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    age: { type: Number, min: 1, max: 150 },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    universityName: { type: String, trim: true, maxlength: 200 },
    course: { type: String, trim: true, maxlength: 200 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model('User', userSchema);
```

- [ ] **Step 2: Write `publicUser.ts`**

Path: `shloka-backend/src/lib/publicUser.ts`:

```ts
import type { UserDoc } from '../models/User';

export interface PublicUser {
  id: string;
  email: string;
  role: 'student' | 'admin';
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  universityName?: string;
  course?: string;
  createdAt: string;
}

export function toPublicUser(doc: UserDoc): PublicUser {
  return {
    id: doc._id.toString(),
    email: doc.email,
    role: doc.role as 'student' | 'admin',
    name: doc.name,
    age: doc.age ?? undefined,
    gender: (doc.gender as 'male' | 'female' | 'other' | undefined) ?? undefined,
    universityName: doc.universityName ?? undefined,
    course: doc.course ?? undefined,
    createdAt: (doc.createdAt as Date).toISOString(),
  };
}
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean (closes the gap left by Task 7).

- [ ] **Step 4: Commit**

```bash
git add src/models/User.ts src/lib/publicUser.ts
git commit -m "feat: User model + PublicUser mapper"
```

---

## Task 9: Auth Middleware (requireAuth, requireRole, errorHandler)

**Files:**
- Create: `shloka-backend/src/middleware/requireAuth.ts`
- Create: `shloka-backend/src/middleware/requireRole.ts`
- Create: `shloka-backend/src/middleware/errorHandler.ts`

Behavior verified by integration test in Task 11.

- [ ] **Step 1: Write `requireAuth.ts`**

Path: `shloka-backend/src/middleware/requireAuth.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';
import { verifySession } from '../lib/jwt';
import { SESSION_COOKIE_NAME } from '../lib/cookies';
import { User } from '../models/User';
import { toPublicUser } from '../lib/publicUser';
import { env } from '../env';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not signed in' } });
    return;
  }
  try {
    const payload = verifySession(token, env().JWT_SECRET);
    const doc = await User.findById(payload.sub);
    if (!doc) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session invalid' } });
      return;
    }
    req.user = toPublicUser(doc);
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session invalid' } });
  }
}
```

- [ ] **Step 2: Write `requireRole.ts`**

Path: `shloka-backend/src/middleware/requireRole.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';

export function requireRole(role: 'student' | 'admin') {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not signed in' } });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
      return;
    }
    next();
  };
}
```

- [ ] **Step 3: Write `errorHandler.ts`**

Path: `shloka-backend/src/middleware/errorHandler.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
```

- [ ] **Step 4: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/middleware/
git commit -m "feat: requireAuth, requireRole, and centralized errorHandler"
```

---

## Task 10: Health Route + Server Bootstrap

**Files:**
- Create: `shloka-backend/src/routes/health.ts`
- Replace: `shloka-backend/src/server.ts` (currently placeholder)
- Test: `shloka-backend/tests/health.test.ts`

- [ ] **Step 1: Write the failing test**

Path: `shloka-backend/tests/health.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/server';

let app: ReturnType<typeof buildApp>;

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';
  process.env.MONGO_URI = 'mongodb://localhost:27017/test';
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_PASSWORD = 'strongpw1';
  process.env.ADMIN_NAME = 'Admin';
  app = buildApp();
});

describe('GET /api/health', () => {
  it('returns ok with mongoState', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.uptime).toBe('number');
    expect(['connected', 'connecting', 'disconnected', 'disconnecting']).toContain(res.body.mongoState);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- health
```

Expected: FAIL — `buildApp` not exported.

- [ ] **Step 3: Write `routes/health.ts`**

Path: `shloka-backend/src/routes/health.ts`:

```ts
import { Router } from 'express';
import { mongoStateLabel } from '../db';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), mongoState: mongoStateLabel() });
});
```

- [ ] **Step 4: Replace `server.ts`**

Path: `shloka-backend/src/server.ts`:

```ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './env';
import { connectDb } from './db';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';

export function buildApp(): express.Express {
  const app = express();
  const e = env();

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // server-to-server / curl
        if (e.FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type'],
    }),
  );

  app.use('/api/health', healthRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
  app.use(errorHandler);

  return app;
}

async function main(): Promise<void> {
  const e = env();
  await connectDb(e.MONGO_URI);
  const app = buildApp();
  app.listen(e.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`shloka-backend listening on :${e.PORT}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
```

- [ ] **Step 5: Run health test**

```bash
npm test -- health
```

Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/server.ts src/routes/health.ts tests/health.test.ts
git commit -m "feat: express server bootstrap + /api/health endpoint"
```

---

## Task 11: Auth Routes + Integration Tests

**Files:**
- Create: `shloka-backend/src/routes/auth.ts`
- Modify: `shloka-backend/src/server.ts` (mount /api/auth)
- Test: `shloka-backend/tests/auth.integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

Path: `shloka-backend/tests/auth.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { buildApp } from '../src/server';
import { User } from '../src/models/User';

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
  await mongoose.connect(mongod.getUri());
  app = buildApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

function extractCookie(res: request.Response): string | undefined {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return undefined;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr.find(c => c.startsWith('sht_session='));
}

const VALID_SIGNUP = {
  email: 'student@example.com',
  password: 'hunter2hunter',
  name: 'A Student',
  age: 22,
  gender: 'male',
  universityName: 'Test U',
  course: 'BAMS',
};

describe('auth routes', () => {
  it('signup creates a student and sets session cookie', async () => {
    const res = await request(app).post('/api/auth/signup').send(VALID_SIGNUP);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('student@example.com');
    expect(res.body.user.role).toBe('student');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(extractCookie(res)).toBeDefined();
  });

  it('signup with existing email → 409 EMAIL_TAKEN', async () => {
    await request(app).post('/api/auth/signup').send(VALID_SIGNUP);
    const res = await request(app).post('/api/auth/signup').send(VALID_SIGNUP);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('signup with weak password → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...VALID_SIGNUP, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login with correct creds returns user and sets cookie', async () => {
    await request(app).post('/api/auth/signup').send(VALID_SIGNUP);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_SIGNUP.email, password: VALID_SIGNUP.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(VALID_SIGNUP.email);
    expect(extractCookie(res)).toBeDefined();
  });

  it('login with wrong password → 401 INVALID_CREDENTIALS', async () => {
    await request(app).post('/api/auth/signup').send(VALID_SIGNUP);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_SIGNUP.email, password: 'wrongwrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('login with unknown email → 401 INVALID_CREDENTIALS (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /me without cookie → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /me with valid cookie → 200 with user', async () => {
    const signup = await request(app).post('/api/auth/signup').send(VALID_SIGNUP);
    const cookie = extractCookie(signup)!;
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(VALID_SIGNUP.email);
  });

  it('logout clears cookie; subsequent /me is 401', async () => {
    const signup = await request(app).post('/api/auth/signup').send(VALID_SIGNUP);
    const cookie = extractCookie(signup)!;
    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);
    const cleared = extractCookie(logout);
    expect(cleared).toMatch(/sht_session=;/); // cleared cookie
    const me = await request(app).get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- auth.integration
```

Expected: FAIL — auth routes do not exist.

- [ ] **Step 3: Write `routes/auth.ts`**

Path: `shloka-backend/src/routes/auth.ts`:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { hashPassword, comparePassword } from '../lib/password';
import { signSession } from '../lib/jwt';
import { setSessionCookie, clearSessionCookie } from '../lib/cookies';
import { toPublicUser } from '../lib/publicUser';
import { env } from '../env';
import { requireAuth } from '../middleware/requireAuth';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
  age: z.number().int().min(1).max(150).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  universityName: z.string().max(200).optional(),
  course: z.string().max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(200),
});

authRouter.post('/signup', async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const existing = await User.findOne({ email: body.email });
    if (existing) {
      res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } });
      return;
    }
    const passwordHash = await hashPassword(body.password);
    const user = await User.create({
      email: body.email,
      passwordHash,
      role: 'student',
      name: body.name,
      age: body.age,
      gender: body.gender,
      universityName: body.universityName,
      course: body.course,
    });
    const e = env();
    const token = signSession(user._id.toString(), e.JWT_SECRET);
    setSessionCookie(res, token, e.NODE_ENV === 'production');
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await User.findOne({ email: body.email });
    const invalid = () => res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } });
    if (!user) {
      // Still hash to mitigate timing side channels
      await hashPassword(body.password);
      invalid();
      return;
    }
    const ok = await comparePassword(body.password, user.passwordHash);
    if (!ok) {
      invalid();
      return;
    }
    user.lastLoginAt = new Date();
    await user.save();
    const e = env();
    const token = signSession(user._id.toString(), e.JWT_SECRET);
    setSessionCookie(res, token, e.NODE_ENV === 'production');
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res, env().NODE_ENV === 'production');
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
```

- [ ] **Step 4: Mount `/api/auth` in server.ts**

Path: `shloka-backend/src/server.ts`. Modify the `buildApp` function. Find:

```ts
  app.use('/api/health', healthRouter);
```

Add the auth router import at the top of the file:

```ts
import { authRouter } from './routes/auth';
```

And replace the health line with:

```ts
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
```

- [ ] **Step 5: Run integration tests**

```bash
npm test -- auth.integration
```

Expected: 9 tests pass.

- [ ] **Step 6: Run all tests + lint + tsc**

```bash
npm test && npm run lint && npx tsc --noEmit
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/routes/auth.ts src/server.ts tests/auth.integration.test.ts
git commit -m "feat: auth routes (signup, login, logout, me) with integration tests"
```

---

## Task 12: Admin Seed Script

**Files:**
- Create: `shloka-backend/src/scripts/seedAdmin.ts`
- Test: `shloka-backend/tests/seedAdmin.test.ts`

- [ ] **Step 1: Write the failing test**

Path: `shloka-backend/tests/seedAdmin.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User';
import { seedAdmin } from '../src/scripts/seedAdmin';
import { comparePassword } from '../src/lib/password';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('seedAdmin', () => {
  it('creates an admin when none exists', async () => {
    await seedAdmin({ email: 'admin@x.test', password: 'strongpw1', name: 'Admin One' });
    const doc = await User.findOne({ email: 'admin@x.test' });
    expect(doc).not.toBeNull();
    expect(doc!.role).toBe('admin');
    expect(doc!.name).toBe('Admin One');
    expect(await comparePassword('strongpw1', doc!.passwordHash)).toBe(true);
  });

  it('updates password + ensures admin role when user already exists', async () => {
    await seedAdmin({ email: 'admin@x.test', password: 'firstpw1', name: 'Admin One' });
    await seedAdmin({ email: 'admin@x.test', password: 'secondpw2', name: 'Admin Two' });
    const docs = await User.find({ email: 'admin@x.test' });
    expect(docs).toHaveLength(1);
    expect(docs[0].role).toBe('admin');
    expect(docs[0].name).toBe('Admin Two');
    expect(await comparePassword('secondpw2', docs[0].passwordHash)).toBe(true);
  });

  it('promotes an existing student to admin', async () => {
    await User.create({
      email: 'someone@x.test',
      passwordHash: 'irrelevant',
      role: 'student',
      name: 'Was Student',
    });
    await seedAdmin({ email: 'someone@x.test', password: 'newpass12', name: 'Now Admin' });
    const doc = await User.findOne({ email: 'someone@x.test' });
    expect(doc!.role).toBe('admin');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- seedAdmin
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Path: `shloka-backend/src/scripts/seedAdmin.ts`:

```ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { hashPassword } from '../lib/password';
import { env } from '../env';
import { connectDb, disconnectDb } from '../db';

export interface SeedAdminInput {
  email: string;
  password: string;
  name: string;
}

export async function seedAdmin(input: SeedAdminInput): Promise<void> {
  const passwordHash = await hashPassword(input.password);
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
    existing.name = input.name;
    await existing.save();
    // eslint-disable-next-line no-console
    console.log(`[seedAdmin] updated existing user ${input.email} → role=admin`);
    return;
  }
  await User.create({
    email: input.email.toLowerCase(),
    passwordHash,
    role: 'admin',
    name: input.name,
  });
  // eslint-disable-next-line no-console
  console.log(`[seedAdmin] created admin ${input.email}`);
}

async function main(): Promise<void> {
  const e = env();
  await connectDb(e.MONGO_URI);
  try {
    await seedAdmin({ email: e.ADMIN_EMAIL, password: e.ADMIN_PASSWORD, name: e.ADMIN_NAME });
  } finally {
    await disconnectDb();
    await mongoose.connection.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().then(
    () => process.exit(0),
    err => {
      // eslint-disable-next-line no-console
      console.error('[seedAdmin] failed:', err);
      process.exit(1);
    },
  );
}
```

- [ ] **Step 4: Run tests + verify**

```bash
npm test -- seedAdmin
npm run lint && npx tsc --noEmit
```

Expected: 3 tests pass, lint and tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/seedAdmin.ts tests/seedAdmin.test.ts
git commit -m "feat: idempotent admin seed script"
```

---

## Task 13: Render Deploy Config + README

**Files:**
- Create: `shloka-backend/render.yaml`
- Create: `shloka-backend/README.md`

- [ ] **Step 1: Write `render.yaml`**

Path: `shloka-backend/render.yaml`:

```yaml
services:
  - type: web
    name: shloka-backend
    runtime: node
    plan: free
    region: oregon
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: MONGO_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: FRONTEND_ORIGIN
        sync: false
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
      - key: ADMIN_NAME
        sync: false
```

- [ ] **Step 2: Write `README.md`**

Path: `shloka-backend/README.md`:

```markdown
# shloka-backend

Node/Express/TypeScript backend for the Shloka Sutra app.

## Stack

- Express 4, TypeScript 5, Mongoose 8
- MongoDB Atlas (M0 free tier)
- JWT in httpOnly cookie
- Vitest + supertest + mongodb-memory-server

## Local Development

```bash
cp .env.example .env       # fill in MONGO_URI, JWT_SECRET, etc.
npm install
npm run dev                # starts on http://localhost:4000
```

A local MongoDB is required (or point MONGO_URI at Atlas).

## Tests

```bash
npm test                   # vitest run
npm run test:watch
```

Tests use `mongodb-memory-server` — no external DB needed.

## Seeding the First Admin

After env vars are set:

```bash
npm run seed:admin
```

Idempotent. Reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` from `.env`.

## Deployment (Render)

1. Push this repo to GitHub.
2. In Render, "New +" → "Blueprint" and point to this repo. It picks up `render.yaml`.
3. Set the secret env vars in the Render dashboard:
   - `MONGO_URI` (from MongoDB Atlas — make sure Atlas IP allowlist includes `0.0.0.0/0` since Render free tier has no static outbound IPs)
   - `JWT_SECRET` (random 32+ char string)
   - `FRONTEND_ORIGIN` (your deployed frontend URL, comma-separate to allow more than one)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`
4. Deploy. Health check at `/api/health` should pass.
5. Once up, run `npm run seed:admin` via Render's shell to create the first admin.

Free tier sleeps after 15 min idle — first request after sleep takes ~30s.

## API Surface (v1)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/auth/signup | none | creates student |
| POST | /api/auth/login | none | sets sht_session cookie |
| POST | /api/auth/logout | any | clears cookie |
| GET  | /api/auth/me | required | returns current user |
| GET  | /api/health | none | uptime + mongo state |
```

- [ ] **Step 3: Commit**

```bash
git add render.yaml README.md
git commit -m "docs: add Render deploy config and README"
```

---

## Task 14: Frontend — Auth Types + API Client

**Files (frontend repo):**
- Create: `kayachikitsasutrani/src/lib/auth/types.ts`
- Create: `kayachikitsasutrani/src/lib/api.ts`
- Create or modify: `kayachikitsasutrani/.env.local`

Switch directory: `cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani`

- [ ] **Step 1: Write `lib/auth/types.ts`**

Path: `src/lib/auth/types.ts`:

```ts
export interface PublicUser {
  id: string;
  email: string;
  role: 'student' | 'admin';
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  universityName?: string;
  course?: string;
  createdAt: string;
}

export interface SignupBody {
  email: string;
  password: string;
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  universityName?: string;
  course?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface ApiError extends Error {
  code: string;
  status: number;
}
```

- [ ] **Step 2: Write `lib/api.ts`**

Path: `src/lib/api.ts`:

```ts
import type { PublicUser, SignupBody, LoginBody, ApiError } from './auth/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } & Record<string, unknown>;
  if (!res.ok) {
    const code = body?.error?.code ?? `HTTP_${res.status}`;
    const message = body?.error?.message ?? `Request failed (${res.status})`;
    const err = new Error(message) as ApiError;
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return body as unknown as T;
}

export const api = {
  signup: (body: SignupBody) =>
    request<{ user: PublicUser }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: LoginBody) =>
    request<{ user: PublicUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: PublicUser }>('/api/auth/me'),
};
```

- [ ] **Step 3: Add `NEXT_PUBLIC_API_URL` to `.env.local`**

Path: `.env.local`. If the file doesn't exist, create it:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

If it exists, append the line (don't overwrite other vars).

- [ ] **Step 4: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/types.ts src/lib/api.ts .env.local
git commit -m "feat: add auth types + api client for backend communication"
```

---

## Task 15: Frontend — AuthContext

**Files:**
- Create: `kayachikitsasutrani/src/lib/auth/AuthContext.tsx`

- [ ] **Step 1: Write the file**

Path: `src/lib/auth/AuthContext.tsx`:

```tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";
import type { PublicUser, SignupBody, LoginBody, ApiError } from "./types";

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "authed"; user: PublicUser };

interface AuthApi {
  state: AuthState;
  login: (body: LoginBody) => Promise<void>;
  signup: (body: SignupBody) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setState({ status: "authed", user });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) {
        setState({ status: "anon" });
      } else {
        // network or unknown — treat as anon for now, log
        // eslint-disable-next-line no-console
        console.error("auth.me failed", err);
        setState({ status: "anon" });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (body: LoginBody) => {
    const { user } = await api.login(body);
    setState({ status: "authed", user });
  }, []);

  const signup = useCallback(async (body: SignupBody) => {
    const { user } = await api.signup(body);
    setState({ status: "authed", user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ status: "anon" });
    }
  }, []);

  return <Ctx.Provider value={{ state, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/AuthContext.tsx
git commit -m "feat: AuthContext + useAuth hook"
```

---

## Task 16: Frontend — Wire AuthProvider in Root Layout

**Files:**
- Modify: `kayachikitsasutrani/src/app/layout.tsx`

- [ ] **Step 1: Read the file**

Open `src/app/layout.tsx` and note its current structure. Most likely it has a `<RootLayout>` that wraps `{children}` along with Navbar and Footer.

- [ ] **Step 2: Wrap children with AuthProvider**

At the top of the file, add:

```tsx
import { AuthProvider } from "@/lib/auth/AuthContext";
```

Wrap whatever currently surrounds `{children}` so that `<AuthProvider>` is outside Navbar and Footer (so they can call `useAuth()`):

```tsx
<AuthProvider>
  <Navbar />
  {children}
  <Footer />
</AuthProvider>
```

(Adapt to the existing JSX — preserve all other tags. Only inject `<AuthProvider>` as a wrapper.)

- [ ] **Step 3: Verify tsc + lint + build**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean (warnings in unrelated files OK).

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wrap root layout with AuthProvider"
```

---

## Task 17: Frontend — Wire Signup Form

**Files:**
- Modify: `kayachikitsasutrani/src/app/signup/Signup.tsx`

- [ ] **Step 1: Read the file**

Open `src/app/signup/Signup.tsx`. The form currently logs state but doesn't submit anywhere.

- [ ] **Step 2: Wire submit handler**

Add at the top:

```tsx
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";
```

Inside the component, before the return:

```tsx
const { signup } = useAuth();
const router = useRouter();
const [error, setError] = useState<string | null>(null);
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setSubmitting(true);
  try {
    await signup({
      email: formState.email,
      password: formState.password,
      name: formState.name,
      age: formState.age ? Number(formState.age) : undefined,
      gender:
        formState.gender === "male" || formState.gender === "female" || formState.gender === "other"
          ? formState.gender
          : undefined,
      universityName: formState.universityName || undefined,
      course: formState.course || undefined,
    });
    router.push("/dashboard");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign up failed";
    setError(message);
  } finally {
    setSubmitting(false);
  }
};
```

(Adapt `formState` field names to match the actual state object in the file. If state lives under different names like `name`, `email`, etc., reference those.)

Attach to the form: change the `<form>` element to `<form onSubmit={handleSubmit}>`. If the submit button currently has `onClick={...}`, remove that and ensure the button is `type="submit"`. Disable the button when `submitting` is true.

Add an error message line near the submit button:

```tsx
{error && <p className="text-red-600 text-sm">{error}</p>}
```

- [ ] **Step 3: Verify tsc + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean (warnings in unrelated files OK).

- [ ] **Step 4: Commit**

```bash
git add src/app/signup/Signup.tsx
git commit -m "feat: wire signup form to backend via useAuth"
```

---

## Task 18: Frontend — Login Page

**Files:**
- Create: `kayachikitsasutrani/src/app/login/page.tsx`
- Create: `kayachikitsasutrani/src/app/login/Login.tsx`

- [ ] **Step 1: Write `page.tsx`**

Path: `src/app/login/page.tsx`:

```tsx
import React from "react";
import Login from "./Login";

const Page = () => <Login />;

export default Page;
```

- [ ] **Step 2: Write `Login.tsx`**

Path: `src/app/login/Login.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";

const Login = () => {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-10 max-w-md mx-auto">
      <h1 className="text-2xl mb-4">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-100 hover:bg-indigo-200 px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm mt-4">
        No account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </div>
  );
};

export default Login;
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/
git commit -m "feat: add /login page with form wired to useAuth"
```

---

## Task 19: Frontend — Navbar Auth State

**Files:**
- Modify: `kayachikitsasutrani/src/components/Navbar.tsx`

- [ ] **Step 1: Read the file**

Open `src/components/Navbar.tsx`. Currently shows static Login / Signup links.

- [ ] **Step 2: Modify to react to auth state**

Add imports at the top:

```tsx
"use client";
import { useAuth } from "@/lib/auth/AuthContext";
```

(The "use client" directive may already be there. If the file does not currently use "use client", add it.)

Inside the component, add:

```tsx
const { state, logout } = useAuth();
```

Replace the Login/Signup link section with a conditional render. Keep the same wrapper classNames so layout is preserved. Example replacement (adapt to the existing JSX structure — the wrapper div should not change):

```tsx
{state.status === "authed" ? (
  <div className="flex items-center gap-3">
    <span className="text-sm">Hi, {state.user.name}</span>
    <button
      onClick={() => void logout()}
      className="text-sm underline"
    >
      Log out
    </button>
  </div>
) : (
  <div className="flex items-center gap-3">
    <Link href="/login" className="text-sm">Log in</Link>
    <Link href="/signup" className="text-sm">Sign up</Link>
  </div>
)}
```

If `Link` isn't imported, add `import Link from "next/link";` at the top. Preserve any other navbar elements (logo, brand text, etc.).

- [ ] **Step 3: Verify tsc + lint + build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected: tsc clean, lint clean (warnings in unrelated files OK), build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: navbar shows user name + logout when authed"
```

---

## Task 20: End-to-End Manual QA

This is a manual verification step. No code changes unless a bug surfaces.

**Prereqs:**
- MongoDB running locally on default port (e.g. `brew services start mongodb-community` on macOS), OR `MONGO_URI` in backend `.env` pointing to Atlas.
- Backend `.env` populated (copy from `.env.example` and fill in real secrets).
- Frontend `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:4000`.

- [ ] **Step 1: Start backend dev server**

Terminal 1:
```bash
cd ../shloka-backend
npm run dev
```

Expected: logs `shloka-backend listening on :4000`.

- [ ] **Step 2: Seed an admin**

Terminal 2:
```bash
cd ../shloka-backend
npm run seed:admin
```

Expected: `[seedAdmin] created admin <email>` log.

- [ ] **Step 3: Start frontend dev server**

Terminal 3:
```bash
cd kayachikitsasutrani
npm run dev
```

Expected: Next.js on http://localhost:3000.

- [ ] **Step 4: Test signup flow**

Visit http://localhost:3000/signup. Fill out the form with a new email + password. Submit.

Expected:
- Redirected to /dashboard.
- Navbar shows "Hi, <name>" + Log out.
- Refreshing the page keeps you logged in (cookie persists).

- [ ] **Step 5: Test logout**

Click Log out. Expected: navbar reverts to Log in / Sign up. Refresh — still logged out.

- [ ] **Step 6: Test login**

Click Log in. Enter the email + password you just used. Submit.

Expected: redirected to /dashboard, navbar shows name again.

- [ ] **Step 7: Test invalid login**

Log out. Click Log in. Enter the right email but wrong password.

Expected: red error "Email or password is incorrect" (or similar). Stays on /login.

- [ ] **Step 8: Test admin login**

Log out. Log in with the seeded admin email + password.

Expected: redirected to /dashboard, navbar shows admin's name. (Admin UI doesn't exist yet — that's sub-project 2. This step only verifies admin can authenticate.)

- [ ] **Step 9: Test /me directly**

Open browser devtools → Network. Hit http://localhost:4000/api/auth/me directly (or via the page).

Expected: returns `{ user: ... }` with role from the seeded admin. Confirm `Set-Cookie` header was sent on the prior login response.

- [ ] **Step 10: Test CORS**

Without changing anything else, attempt a fetch from a different origin (e.g. open another local server or use curl with a different Origin header). Should be rejected.

```bash
curl -i -H "Origin: http://evil.test" http://localhost:4000/api/auth/me
```

Expected: response lacks `Access-Control-Allow-Origin` for that origin (CORS blocks it).

- [ ] **Step 11: If any step failed, file a bug and fix**

Report findings to the controller before declaring done. If a bug emerges, the controller dispatches a fix subagent.

---

## Verification Checklist

After all tasks complete, run from each repo:

**Backend:**
- [ ] `npm test` — all tests pass (sanity, env, password, jwt, health, auth.integration, seedAdmin)
- [ ] `npm run lint` — clean
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — produces `dist/`
- [ ] `npm run dev` — boots, hits Mongo, listens

**Frontend:**
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run lint` — only pre-existing warnings (none introduced by this work)
- [ ] `npm run build` — succeeds
- [ ] Manual QA (Task 20) passes end-to-end
