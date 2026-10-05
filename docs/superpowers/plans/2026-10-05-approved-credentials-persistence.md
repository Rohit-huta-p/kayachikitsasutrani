# Approved Access-Request Credentials — Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist approved access-request credentials (email + generated password) server-side so the admin Access Requests page shows them from any device, surviving refreshes and cache clears. Backend gains an encrypted `CredentialDelivery` store, a `GET /approved` list, and forget/regenerate/send-email endpoints. Frontend swaps its per-browser `localStorage` cache for these endpoints.

**Architecture:** Pending requests are `User` docs with `status:'pending'`. On `accept`, the server already mints a password, bcrypt-hashes it into `passwordHash`, and flips `status:'active'`. We additionally store the password **AES-256-GCM encrypted** in a new `CredentialDelivery` collection (isolated from `User`), keyed in env (`CREDENTIAL_ENC_KEY`). `GET /approved` decrypts for admins. A retention knob can purge the stored copy on the student's first login. Degrades safely: with no key, approval still works and `password` comes back `null`.

**Tech Stack:** Existing Node 20 / Express / Mongoose 8 / TypeScript / zod / bcrypt + Vitest/supertest/mongodb-memory-server (backend); Next.js 15 / React 19 (frontend). New backend dep: none (`node:crypto`). `nodemailer` already present.

**Spec:** `docs/superpowers/specs/2026-10-05-approved-credentials-persistence-design.md`

**Security note:** This stores a **recoverable** password by design (the admin must relay it). Read the spec's "Security decision" section before starting. If recoverable storage is unacceptable, skip the crypto/store (Tasks 2–3 trivialised) and use `regenerate` as the only reveal path — the endpoint shapes and frontend stay identical, `password` is just always `null`.

**Working directories:**
- Backend: `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend/`
- Frontend: `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani/`

---

## File Structure

**Backend (`shloka-backend/`):**
- Modify: `src/env.ts`, `.env.example`, `render.yaml`
- Create: `src/lib/credentialCrypto.ts`
- Create: `src/models/CredentialDelivery.ts`
- Modify: `src/routes/admin/access-requests.ts`
- Modify: `src/routes/auth.ts`
- Create: `tests/credentialCrypto.test.ts`
- Create: `tests/access-requests-approved.integration.test.ts`
- Create: `tests/credential-retention.integration.test.ts`

**Frontend (`kayachikitsasutrani/`):**
- Modify: `src/lib/auth/types.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/app/admin/access-requests/AccessRequestsPage.tsx`

---

## Task 1: Backend — config (env + example + render)

**Files:** Modify `src/env.ts`, `.env.example`, `render.yaml`

- [ ] **Step 1: Add vars to the zod schema in `src/env.ts`**

Inside the `z.object({ … })`, after the `SIGNUP_NOTIFY_EMAIL` line, add:

```ts
  // Approved access-request credential persistence (spec 2026-10-05).
  // 32-byte key as base64 (recommended) or 64-char hex. If unset, approved
  // credentials are NOT stored and GET /approved returns password: null.
  CREDENTIAL_ENC_KEY: z.string().min(1).optional(),
  // 'until_removed' (default): keep until an admin removes it.
  // 'until_first_login': purge once the student signs in the first time.
  CREDENTIAL_RETENTION: z.enum(['until_removed', 'until_first_login']).default('until_removed'),
```

(No change needed to `parseEnv`/`FRONTEND_ORIGINS`.)

- [ ] **Step 2: Append to `.env.example`**

```bash
# Approved access-request credentials (optional; see docs spec 2026-10-05).
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
CREDENTIAL_ENC_KEY=
CREDENTIAL_RETENTION=until_removed
```

- [ ] **Step 3: Add to `render.yaml` `envVars:`**

```yaml
      - key: CREDENTIAL_ENC_KEY
        sync: false
      - key: CREDENTIAL_RETENTION
        value: until_removed
```

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add src/env.ts .env.example render.yaml
git commit -m "feat(env): credential encryption key + retention policy"
```

---

## Task 2: Backend — AES-256-GCM credential crypto + unit test

**Files:** Create `src/lib/credentialCrypto.ts`, `tests/credentialCrypto.test.ts`

- [ ] **Step 1: Write `src/lib/credentialCrypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SealedSecret {
  ciphertext: string; // base64
  iv: string; // base64 (12 bytes)
  tag: string; // base64 (16 bytes)
}

// Read the key straight from process.env (not the cached env()) so this module
// stays decoupled and unit-testable without the full env. Accepts base64 or hex.
function keyBuf(): Buffer | null {
  const raw = process.env.CREDENTIAL_ENC_KEY;
  if (!raw) return null;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : null;
}

/** True when a valid 32-byte CREDENTIAL_ENC_KEY is configured. */
export function credentialCryptoReady(): boolean {
  return keyBuf() !== null;
}

export function encryptSecret(plain: string): SealedSecret {
  const k = keyBuf();
  if (!k) throw new Error('CREDENTIAL_ENC_KEY missing or not 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSecret(s: SealedSecret): string {
  const k = keyBuf();
  if (!k) throw new Error('CREDENTIAL_ENC_KEY missing or not 32 bytes');
  const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(s.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(s.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(s.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 2: Write `tests/credentialCrypto.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, credentialCryptoReady } from '../src/lib/credentialCrypto.js';

const KEY = Buffer.alloc(32, 7).toString('base64');

afterEach(() => {
  delete process.env.CREDENTIAL_ENC_KEY;
});

describe('credentialCrypto', () => {
  it('round-trips a secret', () => {
    process.env.CREDENTIAL_ENC_KEY = KEY;
    const sealed = encryptSecret('v7Kq-2pML-9za');
    expect(sealed.iv).toBeTruthy();
    expect(sealed.ciphertext).not.toContain('v7Kq');
    expect(decryptSecret(sealed)).toBe('v7Kq-2pML-9za');
  });

  it('detects tampering via the GCM tag', () => {
    process.env.CREDENTIAL_ENC_KEY = KEY;
    const sealed = encryptSecret('secret');
    expect(() => decryptSecret({ ...sealed, ciphertext: Buffer.from('zzzzzz').toString('base64') })).toThrow();
  });

  it('is not ready and throws without a key', () => {
    expect(credentialCryptoReady()).toBe(false);
    expect(() => encryptSecret('x')).toThrow();
  });

  it('rejects a wrong-size key', () => {
    process.env.CREDENTIAL_ENC_KEY = Buffer.alloc(16, 1).toString('base64');
    expect(credentialCryptoReady()).toBe(false);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
npx tsc --noEmit
npm test -- credentialCrypto
git add src/lib/credentialCrypto.ts tests/credentialCrypto.test.ts
git commit -m "feat: AES-256-GCM credential crypto helper + tests"
```

---

## Task 3: Backend — CredentialDelivery model

**Files:** Create `src/models/CredentialDelivery.ts`

- [ ] **Step 1: Write the model**

```ts
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const credentialDeliverySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    // Snapshots so the list/search survive the User being removed.
    email: { type: String, required: true },
    name: { type: String, required: true },
    // AES-256-GCM parts (base64). Null once purged / retention elapsed / key absent.
    passwordCiphertext: { type: String, default: null },
    passwordIv: { type: String, default: null },
    passwordTag: { type: String, default: null },
    approvedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date, required: true },
    deliveredAt: { type: Date, default: null },
    revealedCount: { type: Number, default: 0 },
    lastRevealedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type CredentialDeliveryDoc = HydratedDocument<InferSchemaType<typeof credentialDeliverySchema>>;
export const CredentialDelivery = model('CredentialDelivery', credentialDeliverySchema);
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add src/models/CredentialDelivery.ts
git commit -m "feat: CredentialDelivery model (encrypted, isolated)"
```

---

## Task 4: Backend — access-requests route (persist + list/forget/regenerate/send)

**Files:** Modify `src/routes/admin/access-requests.ts`

- [ ] **Step 1: Add imports at the top**

```ts
import { CredentialDelivery } from '../../models/CredentialDelivery.js';
import { encryptSecret, decryptSecret, credentialCryptoReady } from '../../lib/credentialCrypto.js';
import { sendMail, isMailConfigured } from '../../lib/mailer.js';
```

(`User`, `hashPassword`, `generateRandomPassword`, `env`, `requireAuth`, `requireRole`, `validateObjectId` and the local `buildAcceptanceEmail` are already imported/defined.)

- [ ] **Step 2: Persist the credential inside `POST /:id/accept`**

After the existing `await User.updateOne({ _id: user._id }, { $set: { passwordHash, status: 'active' } });`, insert:

```ts
    // Persist the credential so it stays on the Approved list from any device
    // (spec 2026-10-05). Best-effort — never fail an approval over this.
    try {
      if (credentialCryptoReady()) {
        const sealed = encryptSecret(password);
        await CredentialDelivery.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              email: user.email,
              name: user.name,
              passwordCiphertext: sealed.ciphertext,
              passwordIv: sealed.iv,
              passwordTag: sealed.tag,
              approvedByAdminId: req.user?.id,
              approvedAt: new Date(),
              deliveredAt: null,
              revealedCount: 0,
              lastRevealedAt: null,
            },
          },
          { upsert: true },
        );
      } else {
        console.warn(`[access-requests] CREDENTIAL_ENC_KEY unset — credential for ${user._id} not stored`);
      }
    } catch (err) {
      console.error('[access-requests] failed to persist approved credential', err);
    }
```

- [ ] **Step 3: Add `GET /approved` (before the `/:id/*` POST routes is fine; paths are distinct)**

```ts
// List approved accounts that still have a stored credential, newest first.
// Decrypts the password for the authenticated admin and rebuilds fresh email
// links. Password is null when purged, undecryptable, or the key is absent.
adminAccessRequestsRouter.get('/approved', async (_req, res, next) => {
  try {
    const deliveries = await CredentialDelivery.find().sort({ approvedAt: -1, _id: -1 });
    const users = await User.find({ _id: { $in: deliveries.map((d) => d.userId) } }).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const e = env();
    const origin = e.FRONTEND_ORIGINS[0] ?? '';
    const loginUrl = origin ? `${origin}/login` : '/login';

    const revealed: string[] = [];
    const items = deliveries.map((d) => {
      const u = userMap.get(d.userId.toString());
      let password: string | null = null;
      if (d.passwordCiphertext && d.passwordIv && d.passwordTag && credentialCryptoReady()) {
        try {
          password = decryptSecret({ ciphertext: d.passwordCiphertext, iv: d.passwordIv, tag: d.passwordTag });
          revealed.push(d._id.toString());
        } catch {
          password = null; // e.g. key rotated — treat as unavailable
        }
      }
      const links = password ? buildAcceptanceEmail({ name: d.name, email: d.email, password, loginUrl }) : null;
      return {
        id: d.userId.toString(),
        name: u?.name ?? d.name,
        email: u?.email ?? d.email,
        age: u?.age ?? undefined,
        gender: u?.gender ?? undefined,
        collegeName: u?.collegeName ?? undefined,
        course: u?.course ?? undefined,
        approvedAt: (d.approvedAt as Date).toISOString(),
        deliveredAt: d.deliveredAt ? (d.deliveredAt as Date).toISOString() : null,
        password,
        loginUrl,
        mailtoSubject: links?.subject,
        mailtoBody: links?.body,
        mailto: links?.mailto,
        gmailUrl: links?.gmailUrl,
      };
    });

    if (revealed.length > 0) {
      await CredentialDelivery.updateMany(
        { _id: { $in: revealed } },
        { $inc: { revealedCount: 1 }, $set: { lastRevealedAt: new Date() } },
      );
    }

    res.json({ items });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Add `DELETE /approved/:id` (server-side "Remove")**

```ts
// Purge the stored credential (does NOT deactivate the student). Idempotent.
adminAccessRequestsRouter.delete('/approved/:id', validateObjectId('id', 'Credential'), async (req, res, next) => {
  try {
    await CredentialDelivery.deleteOne({ userId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Add `POST /:id/regenerate` (recovery / reveal)**

```ts
// Mint a fresh password for an active student; re-hash, re-store (encrypted),
// and return it once with email links — same shape as accept.
adminAccessRequestsRouter.post('/:id/regenerate', validateObjectId('id', 'Request'), async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, status: 'active', role: 'student' });
    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Active student not found' } });
      return;
    }
    const password = generateRandomPassword(14);
    const passwordHash = await hashPassword(password);
    await User.updateOne({ _id: user._id }, { $set: { passwordHash } });

    const e = env();
    const origin = e.FRONTEND_ORIGINS[0] ?? '';
    const loginUrl = origin ? `${origin}/login` : '/login';
    const emailMsg = buildAcceptanceEmail({ name: user.name, email: user.email, password, loginUrl });

    try {
      if (credentialCryptoReady()) {
        const sealed = encryptSecret(password);
        await CredentialDelivery.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              email: user.email,
              name: user.name,
              passwordCiphertext: sealed.ciphertext,
              passwordIv: sealed.iv,
              passwordTag: sealed.tag,
              approvedByAdminId: req.user?.id,
              approvedAt: new Date(),
              deliveredAt: null,
              revealedCount: 0,
              lastRevealedAt: null,
            },
          },
          { upsert: true },
        );
      }
    } catch (err) {
      console.error('[access-requests] failed to persist regenerated credential', err);
    }

    res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      password,
      mailtoSubject: emailMsg.subject,
      mailtoBody: emailMsg.body,
      mailto: emailMsg.mailto,
      gmailUrl: emailMsg.gmailUrl,
      loginUrl,
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 6: Add `POST /approved/:id/send-email` (optional — SMTP already wired)**

```ts
// Email the credential directly via nodemailer (lib/mailer.ts).
adminAccessRequestsRouter.post('/approved/:id/send-email', validateObjectId('id', 'Credential'), async (req, res, next) => {
  try {
    if (!isMailConfigured()) {
      res.status(503).json({ error: { code: 'SMTP_NOT_CONFIGURED', message: 'Email is not configured on the server' } });
      return;
    }
    const d = await CredentialDelivery.findOne({ userId: req.params.id });
    if (!d || !d.passwordCiphertext || !d.passwordIv || !d.passwordTag || !credentialCryptoReady()) {
      res.status(409).json({ error: { code: 'CREDENTIAL_UNAVAILABLE', message: 'No stored password — regenerate first' } });
      return;
    }
    let password: string;
    try {
      password = decryptSecret({ ciphertext: d.passwordCiphertext, iv: d.passwordIv, tag: d.passwordTag });
    } catch {
      res.status(409).json({ error: { code: 'CREDENTIAL_UNAVAILABLE', message: 'Stored password could not be read' } });
      return;
    }
    const e = env();
    const origin = e.FRONTEND_ORIGINS[0] ?? '';
    const loginUrl = origin ? `${origin}/login` : '/login';
    const msg = buildAcceptanceEmail({ name: d.name, email: d.email, password, loginUrl });
    await sendMail({ to: d.email, subject: msg.subject, text: msg.body });
    const deliveredAt = new Date();
    await CredentialDelivery.updateOne({ _id: d._id }, { $set: { deliveredAt } });
    res.json({ ok: true, deliveredAt: deliveredAt.toISOString() });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 7: tsc + commit**

```bash
npx tsc --noEmit
git add src/routes/admin/access-requests.ts
git commit -m "feat: persist approved credentials; add /approved list, forget, regenerate, send-email"
```

---

## Task 5: Backend — first-login retention purge in `auth.ts`

**Files:** Modify `src/routes/auth.ts`

- [ ] **Step 1: Ensure imports**

At the top, make sure these exist (add if missing):

```ts
import { env } from '../env.js';
import { CredentialDelivery } from '../models/CredentialDelivery.js';
```

- [ ] **Step 2: Purge on first login**

In the `POST /login` handler, find:

```ts
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
```

Replace it with:

```ts
    // First-login credential purge (spec 2026-10-05): once the student signs
    // in, they own their password — drop the server-stored copy if configured.
    const isFirstLogin = !user.lastLoginAt;
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    if (isFirstLogin && env().CREDENTIAL_RETENTION === 'until_first_login') {
      await CredentialDelivery.deleteOne({ userId: user._id }).catch(() => {});
    }
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/routes/auth.ts
git commit -m "feat(auth): purge stored credential on first login when configured"
```

---

## Task 6: Backend — integration tests

**Files:** Create `tests/access-requests-approved.integration.test.ts`, `tests/credential-retention.integration.test.ts`

> Mirrors the env/seed/cookie setup of `tests/completions.integration.test.ts`. `CREDENTIAL_ENC_KEY` is read from `process.env` directly, so it can be toggled per-test; `CREDENTIAL_RETENTION` goes through the cached `env()`, so the retention case lives in its own file.

- [ ] **Step 1: Write `tests/access-requests-approved.integration.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

vi.mock('cloudinary', async () => await import('../__mocks__/cloudinary.js'));

import { buildApp } from '../src/server.js';
import { User } from '../src/models/User.js';
import { CredentialDelivery } from '../src/models/CredentialDelivery.js';
import { hashPassword } from '../src/lib/password.js';
import { signSession } from '../src/lib/jwt.js';

const ENC_KEY = Buffer.alloc(32, 9).toString('base64');
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
  process.env.CREDENTIAL_ENC_KEY = ENC_KEY;
  process.env.CREDENTIAL_RETENTION = 'until_removed';
  await mongoose.connect(mongod.getUri());
  app = buildApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await CredentialDelivery.deleteMany({});
  process.env.CREDENTIAL_ENC_KEY = ENC_KEY; // restore after the key-missing case
});

const cookie = (userId: string) => `sht_session=${signSession(userId, 'a'.repeat(32))}`;

async function seedAdmin() {
  const a = await User.create({ email: 'root@x.test', passwordHash: await hashPassword('pw'), role: 'admin', name: 'Root', status: 'active' });
  return cookie(a._id.toString());
}
async function seedPending(email = 'p@x.test', name = 'Pending Pat') {
  return User.create({ email, passwordHash: 'throwaway', role: 'student', name, status: 'pending', age: 22, collegeName: 'Govt Ayurveda', course: 'BAMS' });
}

describe('approved credential persistence', () => {
  it('accept stores a credential that /approved can reveal', async () => {
    const admin = await seedAdmin();
    const pending = await seedPending();
    const acc = await request(app).post(`/api/admin/access-requests/${pending._id}/accept`).set('Cookie', admin);
    expect(acc.status).toBe(200);
    const password = acc.body.password as string;
    expect(password).toHaveLength(14);

    const list = await request(app).get('/api/admin/access-requests/approved').set('Cookie', admin);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const item = list.body.items[0];
    expect(item.id).toBe(pending._id.toString());
    expect(item.password).toBe(password);
    expect(item.collegeName).toBe('Govt Ayurveda');
    expect(item.mailto).toContain('mailto:');
  });

  it('/approved is admin-only', async () => {
    const student = await User.create({ email: 's@x.test', passwordHash: await hashPassword('pw'), role: 'student', name: 'Stu', status: 'active' });
    expect((await request(app).get('/api/admin/access-requests/approved')).status).toBe(401);
    expect((await request(app).get('/api/admin/access-requests/approved').set('Cookie', cookie(student._id.toString()))).status).toBe(403);
  });

  it('DELETE /approved/:id forgets the credential but keeps the user active', async () => {
    const admin = await seedAdmin();
    const pending = await seedPending();
    await request(app).post(`/api/admin/access-requests/${pending._id}/accept`).set('Cookie', admin);

    const del = await request(app).delete(`/api/admin/access-requests/approved/${pending._id}`).set('Cookie', admin);
    expect(del.status).toBe(200);
    const list = await request(app).get('/api/admin/access-requests/approved').set('Cookie', admin);
    expect(list.body.items).toHaveLength(0);
    const user = await User.findById(pending._id).lean();
    expect(user?.status).toBe('active');
  });

  it('regenerate issues a new password: old login fails, new works, /approved shows new', async () => {
    const admin = await seedAdmin();
    const pending = await seedPending('r@x.test', 'Regen Rae');
    const first = await request(app).post(`/api/admin/access-requests/${pending._id}/accept`).set('Cookie', admin);
    const oldPw = first.body.password as string;

    const regen = await request(app).post(`/api/admin/access-requests/${pending._id}/regenerate`).set('Cookie', admin);
    expect(regen.status).toBe(200);
    const newPw = regen.body.password as string;
    expect(newPw).not.toBe(oldPw);

    expect((await request(app).post('/api/auth/login').send({ email: 'r@x.test', password: oldPw })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'r@x.test', password: newPw })).status).toBe(200);

    const list = await request(app).get('/api/admin/access-requests/approved').set('Cookie', admin);
    expect(list.body.items[0].password).toBe(newPw);
  });

  it('degrades when the key is absent: accept still works, password comes back null', async () => {
    const admin = await seedAdmin();
    const pending = await seedPending('n@x.test', 'Nokey Nia');
    delete process.env.CREDENTIAL_ENC_KEY;
    const acc = await request(app).post(`/api/admin/access-requests/${pending._id}/accept`).set('Cookie', admin);
    expect(acc.status).toBe(200);
    expect(acc.body.password).toHaveLength(14); // still returned once
    const list = await request(app).get('/api/admin/access-requests/approved').set('Cookie', admin);
    expect(list.body.items).toHaveLength(0); // nothing stored without a key
  });
});
```

- [ ] **Step 2: Write `tests/credential-retention.integration.test.ts`**

Same `beforeAll` block as Step 1 **except** `process.env.CREDENTIAL_RETENTION = 'until_first_login'`. One test:

```ts
  it('purges the stored credential on the student first login', async () => {
    const admin = await seedAdmin();
    const pending = await seedPending('f@x.test', 'First Fay');
    const acc = await request(app).post(`/api/admin/access-requests/${pending._id}/accept`).set('Cookie', admin);
    const pw = acc.body.password as string;

    // Before first login: credential is present.
    let list = await request(app).get('/api/admin/access-requests/approved').set('Cookie', admin);
    expect(list.body.items).toHaveLength(1);

    // Student logs in for the first time.
    expect((await request(app).post('/api/auth/login').send({ email: 'f@x.test', password: pw })).status).toBe(200);

    // Credential is purged.
    list = await request(app).get('/api/admin/access-requests/approved').set('Cookie', admin);
    expect(list.body.items).toHaveLength(0);
  });
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- access-requests-approved credential-retention
# then the full suite:
npm test
git add tests/access-requests-approved.integration.test.ts tests/credential-retention.integration.test.ts
git commit -m "test: approved credential persistence + retention integration tests"
```

Expected: 6 new integration cases green; full suite still green.

---

## Task 7: Frontend — types + api client

**Files:** Modify `src/lib/auth/types.ts`, `src/lib/api.ts`

- [ ] **Step 1: Append `ApprovedAccount` to `types.ts`** (near `AcceptedAccessRequest`)

```ts
/** An approved account with its (recoverable) credential, from GET /approved. */
export interface ApprovedAccount {
  id: string;
  name: string;
  email: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  collegeName?: string;
  course?: string;
  approvedAt: string;
  deliveredAt: string | null;
  /** Null when purged, undecryptable, or the server has no encryption key. */
  password: string | null;
  loginUrl: string;
  mailtoSubject?: string;
  mailtoBody?: string;
  mailto?: string;
  gmailUrl?: string;
}
```

- [ ] **Step 2: Extend the `accessRequests` block in `api.ts`**

Add `ApprovedAccount` to the `import type { … } from './auth/types'` list, then replace the `accessRequests:` block with:

```ts
    accessRequests: {
      list: () => request<{ items: AccessRequest[] }>(`/api/admin/access-requests`),
      accept: (id: string) =>
        request<AcceptedAccessRequest>(`/api/admin/access-requests/${id}/accept`, { method: 'POST' }),
      reject: (id: string) =>
        request<{ ok: true }>(`/api/admin/access-requests/${id}/reject`, { method: 'POST' }),
      approved: () => request<{ items: ApprovedAccount[] }>(`/api/admin/access-requests/approved`),
      regenerate: (id: string) =>
        request<AcceptedAccessRequest>(`/api/admin/access-requests/${id}/regenerate`, { method: 'POST' }),
      forget: (id: string) =>
        request<{ ok: true }>(`/api/admin/access-requests/approved/${id}`, { method: 'DELETE' }),
      sendEmail: (id: string) =>
        request<{ ok: true; deliveredAt: string }>(`/api/admin/access-requests/approved/${id}/send-email`, {
          method: 'POST',
        }),
    },
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/lib/auth/types.ts src/lib/api.ts
git commit -m "feat: api client + ApprovedAccount type for server-persisted credentials"
```

---

## Task 8: Frontend — switch Access Requests page from localStorage to the server

**Files:** Modify `src/app/admin/access-requests/AccessRequestsPage.tsx`

> Keep all existing UI (tabs, search, cards, the `VIEW_KEY` tab/search persistence). Only the Approved data source and the per-card actions change. Remove the `localStorage` approval cache entirely.

- [ ] **Step 1: Swap imports + types**

- Add `ApprovedAccount` to the `@/lib/auth/types` import; drop `AcceptedAccessRequest` only if it becomes unused (it does — accept's response is no longer stored client-side).
- Delete the `StoredApproval` interface, the `APPROVED_KEY` constant, and the `readApproved` / `writeApproved` helpers.
- Change the `Entry` union's approved arm to carry `ApprovedAccount`:

```ts
type Entry =
  | { kind: 'pending'; id: string; name: string; email: string; ts: number; req: AccessRequest }
  | { kind: 'approved'; id: string; name: string; email: string; ts: number; rec: ApprovedAccount };
```

- [ ] **Step 2: Load approved from the server (replace the `localStorage` effect + state)**

- Keep `const [approved, setApproved] = useState<ApprovedAccount[]>([]);`
- Delete `persistApproved` and the `readApproved()` effect.
- Fold the approved fetch into `load()` so one refresh covers both:

```ts
  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const [pending, appr] = await Promise.all([
        api.admin.accessRequests.list(),
        api.admin.accessRequests.approved(),
      ]);
      setItems(pending.items);
      setApproved(appr.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load access requests');
      setItems((cur) => cur ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);
```

- The `approvedAt` → `ts` mapping in the `entries` memo stays the same (`Date.parse(rec.approvedAt)`).

- [ ] **Step 3: Accept → refetch from server**

In `handleAccept`, replace the `persistApproved(...)` + `setItems(filter)` block with: on success, drop the row locally for snappiness, then refetch so the Approved card (with password) appears authoritatively:

```ts
      await api.admin.accessRequests.accept(req.id);
      setItems((prev) => (prev ?? []).filter((p) => p.id !== req.id));
      updateView((cur) => (cur.tab === 'pending' ? { tab: 'all' } : {}));
      await load();
```

(Remove the `StoredApproval` record construction entirely.)

- [ ] **Step 4: Remove → server forget**

```ts
  const removeApproved = async (rec: ApprovedAccount) => {
    if (!confirm(`Remove ${rec.name} from this list?\n\nThis deletes the stored password on the server; it can't be recovered. You can re-issue one with Regenerate.`)) return;
    try {
      await api.admin.accessRequests.forget(rec.id);
      setApproved((cur) => cur.filter((r) => r.id !== rec.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove credential');
    }
  };
```

- [ ] **Step 5: Add a Regenerate handler (for `password: null` cards + "lost password")**

```ts
  const [regenId, setRegenId] = useState<string | null>(null);
  const regenerate = async (rec: ApprovedAccount) => {
    if (!confirm(`Issue a new password for ${rec.name}? Their current password will stop working.`)) return;
    setRegenId(rec.id);
    setError(null);
    try {
      await api.admin.accessRequests.regenerate(rec.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate password');
    } finally {
      setRegenId(null);
    }
  };
```

- [ ] **Step 6: Update `ApprovedCard` / `CredentialPanel` to handle `password: null`**

Pass `onRegenerate` + `regenerating` into `ApprovedCard` → `CredentialPanel`. In `CredentialPanel`:

- When `rec.password` is present: render exactly as today (Email + Password fields, Mail app, Open in Gmail, Remove).
- When `rec.password` is `null`: render an amber notice and a **Regenerate** button instead of the password field / mail buttons:

```tsx
{rec.password === null ? (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-xs text-gray-500">
      Password isn&apos;t stored for this account. Issue a new one to share.
    </p>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onRegenerate}
        disabled={regenerating}
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#8A5A2B] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#754B22] disabled:opacity-50 ${FOCUS_RING}`}
      >
        <KeyRound size={13} aria-hidden="true" /> {regenerating ? 'Issuing…' : 'Regenerate'}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className={`inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 ${FOCUS_RING}`}
      >
        <Trash2 size={13} aria-hidden="true" /> Remove
      </button>
    </div>
  </div>
) : (
  /* existing email + password fields + Mail app / Gmail / Remove */
)}
```

Guard the fields that assume a password: `CredentialField` for Password and the `rec.mailto`/`rec.gmailUrl` anchors render only in the `else` branch (those links are present only when `password` is non-null).

- [ ] **Step 7: Build + commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -15
git add "src/app/admin/access-requests/AccessRequestsPage.tsx"
git commit -m "feat(admin): source approved credentials from the server; add regenerate"
```

---

## Task 9: Push + manual QA

- [ ] **Step 1: Push both repos**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend && git push origin main
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani && git push origin main
```

- [ ] **Step 2: Set `CREDENTIAL_ENC_KEY` on Render** (Dashboard → shloka-backend → Environment). Generate with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Redeploy the backend. (Without the key the feature no-ops: approvals work, passwords show as "not stored".)

- [ ] **Step 3: Manual QA**

| # | Action | Expected |
|---|---|---|
| 1 | Approve a pending request | Card moves to **Approved**; password shown; view jumps to All if you were on Pending |
| 2 | Hard-refresh the page | Approved card + password still there (now from the server) |
| 3 | Open the admin on a **different device/browser** | Same Approved cards + passwords appear |
| 4 | Click **Copy** on password / **Open in Gmail** | Copies; Gmail compose opens pre-filled |
| 5 | Search by name / email; switch tabs | Filters across pending + approved; counts correct |
| 6 | **Remove** an approved card | Card disappears; still gone after refresh; student still in Students list |
| 7 | **Regenerate** on a card (or one showing "not stored") | New password shown; old one no longer logs in |
| 8 | (If `until_first_login`) student logs in once | Card's password flips to "not stored" on next admin refresh |
| 9 | Pre-existing approved student (approved before this feature) | Shows "not stored" + Regenerate (expected — no password was ever stored) |

- [ ] **Step 4: Report findings** — paste any errors here.

---

## Verification Checklist

- [ ] Backend: `npx tsc --noEmit` clean
- [ ] Backend: unit + integration suites green (incl. 4 crypto + 6 new integration cases)
- [ ] Backend: `npm run lint` clean
- [ ] Backend: `CREDENTIAL_ENC_KEY` set on Render
- [ ] Frontend: `npx tsc --noEmit` + `npm run build` clean
- [ ] Frontend: no remaining references to `APPROVED_KEY` / `readApproved` / `writeApproved`
- [ ] Manual QA (Task 9) passes, including the cross-device check (#3)
- [ ] Rollout order honored: backend deployed (with key) before/with frontend
