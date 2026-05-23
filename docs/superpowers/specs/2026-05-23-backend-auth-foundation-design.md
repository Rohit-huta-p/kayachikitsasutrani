# Backend Auth + DB Foundation

**Status:** Draft
**Date:** 2026-05-23
**Scope:** Sub-project 1 of a multi-phase backend buildout. Auth only.
**Repos:** new `shloka-backend` (Node/Express/TS), additive changes to existing `kayachikitsasutrani` (Next.js).

## Goal

Stand up a Node.js + MongoDB backend that supports:

1. Student signup and login.
2. Admin login (admin accounts are seeded via CLI, not signup).
3. Role-based access control (`student` vs `admin`).
4. End-to-end auth from the existing Next.js frontend via httpOnly cookie + JWT.

After this sub-project ships, a user can:
- Visit `/signup`, register, and be auto-logged in.
- Visit `/login`, sign in, and see their name in the navbar.
- Log out.
- Hit a protected backend route with their session cookie and get the right response based on role.

## Non-Goals

- Email verification, password reset, OAuth, MFA, magic links — all deferred.
- Admin UI for promoting users to admin — admins created via `npm run seed:admin` only.
- Gating any existing frontend route behind auth — shloka page stays public. Route protection is a later sub-project.
- Shloka data in MongoDB — still JSON files for now. Sub-project 2 migrates that.
- Audio uploads — sub-project 2.

## Constraints

- **Backend:** Node.js (latest LTS) + Express + Mongoose + TypeScript.
- **Database:** MongoDB Atlas free tier (M0, 512MB).
- **Hosting:** Render Web Service for backend (accept free-tier cold starts). Frontend stays on whatever the user chooses (Vercel/Render Static).
- **Auth:** JWT (HS256) in an httpOnly + Secure + SameSite=lax cookie. 7-day expiry. Single session token — no separate refresh token in v1.
- **CORS:** Backend whitelists a single configured frontend origin with `credentials: true`.
- **Admin onboarding:** Seeded via CLI script. First admin's credentials come from env vars.

## Decisions

| Topic | Choice |
|---|---|
| Language | TypeScript |
| Web framework | Express |
| ODM | Mongoose |
| Validation | zod for request bodies |
| Password hashing | bcrypt (cost factor 12) |
| Session transport | httpOnly cookie `sht_session`, JWT inside |
| Token lifetime | 7 days |
| Roles | Enum: `student` \| `admin` |
| Admin seeding | `npm run seed:admin` reads env vars |
| Repo layout | Separate repo `shloka-backend` |
| Testing | Vitest + supertest + mongodb-memory-server |
| Deploy | Render Web Service + MongoDB Atlas |

## Architecture

### Backend repo

```
shloka-backend/
├── src/
│   ├── server.ts              Express app, middleware chain, port bind
│   ├── db.ts                  Mongoose connect + graceful disconnect
│   ├── env.ts                 zod-validated process.env loader
│   ├── models/
│   │   └── User.ts            Mongoose schema + model
│   ├── routes/
│   │   ├── auth.ts            signup, login, logout, me
│   │   └── health.ts          GET /api/health
│   ├── middleware/
│   │   ├── requireAuth.ts     verifies JWT cookie, attaches req.user
│   │   ├── requireRole.ts     factory: requireRole('admin')
│   │   └── errorHandler.ts    final express error handler
│   ├── lib/
│   │   ├── jwt.ts             signSession(userId), verifySession(token)
│   │   ├── password.ts        hashPassword, comparePassword
│   │   └── cookies.ts         setSessionCookie(res, token), clearSessionCookie(res)
│   └── scripts/
│       └── seedAdmin.ts       upsert admin user from env
├── tests/
│   ├── auth.integration.test.ts
│   ├── jwt.test.ts
│   └── password.test.ts
├── render.yaml
├── .env.example
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.mjs
├── package.json
└── README.md
```

### Frontend changes (additive)

```
kayachikitsasutrani/
└── src/
    ├── lib/
    │   ├── api.ts                fetch wrapper (NEXT_PUBLIC_API_URL, credentials: 'include')
    │   └── auth/
    │       ├── AuthContext.tsx   React context: { user, login, signup, logout, refresh }
    │       └── useAuth.ts        consumer hook
    ├── app/
    │   ├── layout.tsx            wrap with <AuthProvider>
    │   ├── signup/
    │   │   └── Signup.tsx        wire form to api.signup()
    │   └── login/
    │       ├── page.tsx          NEW
    │       └── Login.tsx         NEW
    └── components/
        └── Navbar.tsx            show user name + Logout when logged in
```

## Data Model

### User collection

```ts
// src/models/User.ts (Mongoose schema)
{
  _id: ObjectId,
  email: string,              // unique, lowercase, trimmed, indexed
  passwordHash: string,       // bcrypt
  role: 'student' | 'admin',  // default 'student'
  name: string,               // required
  age?: number,               // 1..150
  gender?: 'male' | 'female' | 'other',
  universityName?: string,
  course?: string,
  createdAt: Date,            // auto
  updatedAt: Date,            // auto
  lastLoginAt?: Date,         // updated on successful login
}
```

Indexes:
- `{ email: 1 }` unique

Public-facing user shape (returned to client, never includes `passwordHash`):

```ts
type PublicUser = {
  id: string;
  email: string;
  role: 'student' | 'admin';
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  universityName?: string;
  course?: string;
  createdAt: string;  // ISO
}
```

## Endpoints

All under base path `/api`. JSON in/out. Responses are wrapped: success = the payload directly, error = `{ error: { code, message } }`.

### `POST /api/auth/signup`

Public. Creates a `student`. Logs them in.

Request body (zod-validated):
```ts
{
  email: string;             // valid email, lowercased
  password: string;          // min 8 chars
  name: string;              // 1..100
  age?: number;              // 1..150 integer
  gender?: 'male' | 'female' | 'other';
  universityName?: string;   // max 200
  course?: string;           // max 200
}
```

Response 200: `{ user: PublicUser }` + sets cookie.
Response 400: validation error.
Response 409: `{ error: { code: 'EMAIL_TAKEN', message: '...' } }` if email already registered.

### `POST /api/auth/login`

Public.

Request body:
```ts
{ email: string; password: string }
```

Response 200: `{ user: PublicUser }` + sets cookie + updates `lastLoginAt`.
Response 400: validation error.
Response 401: `{ error: { code: 'INVALID_CREDENTIALS', message: '...' } }` — same code/message whether email missing or password wrong (prevents user enumeration).

### `POST /api/auth/logout`

Any authenticated user. Clears the session cookie.

Response 200: `{ ok: true }`.

### `GET /api/auth/me`

Any authenticated user.

Response 200: `{ user: PublicUser }`.
Response 401: not authenticated.

### `GET /api/health`

Public.

Response 200: `{ ok: true, uptime: number, mongoState: 'connected'|'connecting'|'disconnected' }`.

## Auth Flow

1. `signSession(userId)` → JWT, HS256, payload `{ sub: userId, iat, exp }`, signed with `JWT_SECRET`.
2. `setSessionCookie(res, token)` writes cookie:
   - Name: `sht_session`
   - `httpOnly: true`
   - `secure: NODE_ENV === 'production'`
   - `sameSite: 'lax'`
   - `maxAge: 7 * 24 * 60 * 60 * 1000`
   - `path: '/'`
3. `requireAuth` middleware reads `req.cookies.sht_session`, calls `verifySession`, fetches the user from Mongo, attaches `req.user` (PublicUser shape). If anything fails → 401.
4. `requireRole(role)` returns middleware that checks `req.user.role === role` → 403 otherwise.

Cookie domain considerations: since backend and frontend will be on different origins (e.g. `backend.onrender.com` and `frontend.vercel.app`), `SameSite=lax` is the practical compromise — cookies are sent on top-level navigations and same-site requests, and on cross-site `fetch` requests when the frontend sends `credentials: 'include'`. For cross-origin browser fetches to work with cookies the browser also requires `Secure: true` and the response to include `Access-Control-Allow-Credentials: true` plus an explicit `Access-Control-Allow-Origin` (not `*`). All of that is handled in CORS middleware setup.

## CORS

```ts
cors({
  origin: env.FRONTEND_ORIGIN,  // exact match, no wildcard
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type'],
});
```

Multiple frontend origins (e.g. local dev + production) handled by accepting `FRONTEND_ORIGIN` as comma-separated string in env, then a function that matches the request's `Origin` header against the allowed list.

## Admin Seeding

Script: `src/scripts/seedAdmin.ts`. Run with `npm run seed:admin`.

Behavior:
1. Connect to Mongo.
2. Read `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` from env. Fail loudly if missing.
3. `User.findOne({ email })`:
   - If exists: update `passwordHash`, ensure `role: 'admin'`, log "Updated existing admin".
   - If not: create with role `admin`, log "Created admin".
4. Disconnect, exit 0.

Idempotent. Safe to run repeatedly.

In production on Render, run via Render's one-off "Job" or shell session after deploy.

## Environment Variables

```bash
# .env.example
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/shloka
JWT_SECRET=change-me-min-32-chars-long
FRONTEND_ORIGIN=http://localhost:3000

# Admin seeder
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-strong-password
ADMIN_NAME=Admin User
```

`env.ts` validates all of these via zod at startup. Server refuses to start with invalid env (clear error message).

Frontend adds: `NEXT_PUBLIC_API_URL=http://localhost:4000`

## Error Handling

Standard error shape:
```ts
{ error: { code: string; message: string } }
```

Codes used in v1:
- `VALIDATION_ERROR` (400) — zod failure, message includes details
- `INVALID_CREDENTIALS` (401) — login failure (intentionally vague)
- `UNAUTHENTICATED` (401) — missing/invalid session cookie
- `FORBIDDEN` (403) — wrong role
- `EMAIL_TAKEN` (409) — signup conflict
- `NOT_FOUND` (404) — route or resource missing
- `INTERNAL_ERROR` (500) — unhandled

Final `errorHandler` middleware catches everything. In production, 500 responses log the stack server-side but return only a generic message to the client.

## Testing

Vitest + supertest. MongoDB via `mongodb-memory-server` (in-process Mongo for tests, no external DB needed).

**Unit:**
- `lib/password.test.ts` — hash/compare round trip; wrong password fails.
- `lib/jwt.test.ts` — sign/verify round trip; expired token rejected; wrong secret rejected.

**Integration (auth.integration.test.ts):**
- Signup new user → 200, cookie set, user returned without passwordHash.
- Signup with existing email → 409.
- Signup with weak password / missing name → 400.
- Login with correct creds → 200 + cookie.
- Login with wrong password → 401 INVALID_CREDENTIALS.
- Login with unknown email → 401 INVALID_CREDENTIALS (same code, no enumeration).
- GET /me without cookie → 401.
- GET /me with valid cookie → 200 with user.
- Logout clears cookie; subsequent /me returns 401.
- Seed admin script creates admin, role is 'admin', second run updates instead of duplicating.

**Frontend manual QA:**
- Signup form submits, navbar shows logged-in name.
- Logout button clears state, navbar reverts.
- Refresh page → still logged in (cookie persists).
- Login page with wrong password shows error.

## Frontend Integration

### `src/lib/api.ts`

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL!;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const code = body?.error?.code ?? 'HTTP_' + res.status;
    const message = body?.error?.message ?? `Request failed (${res.status})`;
    throw Object.assign(new Error(message), { code, status: res.status });
  }
  return body as T;
}

export const api = {
  signup: (body: SignupBody) => request<{ user: PublicUser }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: LoginBody) => request<{ user: PublicUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: PublicUser }>('/api/auth/me'),
};
```

### `src/lib/auth/AuthContext.tsx`

```ts
type AuthState =
  | { status: 'loading' }
  | { status: 'authed'; user: PublicUser }
  | { status: 'anon' };

type AuthApi = {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  signup: (body: SignupBody) => Promise<void>;
  logout: () => Promise<void>;
};
```

On mount, calls `api.me()`. If 200 → `authed`. If 401 → `anon`. Other errors → `anon` (silent).

### Signup page

Existing form already collects all needed fields. Wire its submit handler to `useAuth().signup(...)`. On success, `router.push('/dashboard')`. On error, show inline message.

### Login page (new)

Email + password fields, submit button, link to signup. Calls `useAuth().login(...)`. On success, navigate. On `INVALID_CREDENTIALS`, show "Email or password is incorrect."

### Navbar

When `state.status === 'authed'`: show `Hi, {name}` + Logout button. Otherwise: existing Login / Signup links.

## Render Deploy

`render.yaml`:

```yaml
services:
  - type: web
    name: shloka-backend
    runtime: node
    plan: free
    region: oregon
    buildCommand: npm install && npm run build
    startCommand: npm start
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
    healthCheckPath: /api/health
```

`sync: false` means Render prompts the operator to set them in the dashboard, not stored in the repo.

Cold start on free tier: ~30s after 15min idle. Acceptable for v1; revisit if it hurts UX.

MongoDB Atlas: M0 (free) cluster, IP allowlist set to `0.0.0.0/0` for Render (since Render free tier doesn't have static outbound IPs) — document this trade-off in README.

## Security Notes

- Passwords hashed with bcrypt cost 12 (~250ms hash). Tunable.
- JWT secret must be ≥32 chars; `env.ts` enforces.
- Cookies httpOnly: JS in browser cannot read them — protects against XSS token theft.
- SameSite=lax: protects against most CSRF on state-changing requests.
- Rate limiting: deferred to next sub-project (add `express-rate-limit` on auth routes when we expose to the public).
- Helmet middleware: include from the start (`app.use(helmet())`).
- HTTPS: handled by Render's edge in prod; locally we run HTTP and `secure: false`.
- No PII in logs (no passwords, no emails in info logs — only IDs).
- 401 vs 403: 401 means "log in"; 403 means "logged in but wrong role".
- User enumeration: signup says "EMAIL_TAKEN" (acceptable here; password reset flow later will need rethink); login uses generic INVALID_CREDENTIALS.

## Open Items (acceptable to defer)

- Refresh tokens / sliding sessions: re-issue cookie on /me hits if older than half the expiry. Not in v1.
- Account lockout after N failed logins: add when sub-project for rate limiting lands.
- Audit log of admin actions: when admin UI exists.
- Email verification: needed before public launch but not now.
