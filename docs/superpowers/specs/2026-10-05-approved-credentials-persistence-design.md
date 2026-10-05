# Approved Access-Request Credentials — Server-Side Persistence

**Status:** Draft
**Date:** 2026-10-05
**Scope:** Make approved access-request credentials (email + generated password) persist on the server so the admin can see them on the Access Requests page from any device, surviving refreshes and browser-cache clears. Adds a "list approved" endpoint plus forget/regenerate/send-email.
**Repos:** `shloka-backend` (Node/Express/TS/Mongoose) — primary. `kayachikitsasutrani` (Next.js) — swap client-side storage for the new endpoints.

---

## Problem & Context

Access requests are `User` documents with `status: 'pending'` (`src/models/User.ts`). The admin flow lives in `src/routes/admin/access-requests.ts`:

- `GET /api/admin/access-requests` — lists **pending** users only.
- `POST /api/admin/access-requests/:id/accept` — generates a 14-char password (`generateRandomPassword`), bcrypt-hashes it into `passwordHash`, flips `status → 'active'`, and returns the **plaintext password once** plus pre-built `mailto`/`gmailUrl`. **The plaintext is never stored.**
- `POST /api/admin/access-requests/:id/reject` — deletes the pending user.

Because the password is returned once and only pending users are listed, an approved account (and its password) disappears from the admin UI the moment the list reloads. The current frontend works around this by caching the accept response in `localStorage` (`src/app/admin/access-requests/AccessRequestsPage.tsx`, key `cs.admin.accessRequests.approved`). That is per-browser only: it does not survive a cache clear, and is invisible on another device.

**Goal:** persist the delivered credential server-side so the "Approved" list and its passwords are authoritative and available everywhere, while keeping password storage as safe as the requirement allows.

---

## ⚠️ Security decision (read first)

Showing the **exact** generated password again, later, on another device, requires storing it in a **recoverable** form (plaintext or reversible encryption). This is a deliberate departure from password best practice (store only a one-way hash). It is acceptable here **only** because:

- These are **system-generated, relay-only** passwords for a small, admin-approved cohort — the admin must hand them to the student.
- We can bound and mitigate the exposure (see below).

Two designs, pick one:

| | **Option A — Store encrypted (recommended)** | **Option B — Store nothing recoverable** |
|---|---|---|
| Password at rest | Encrypted (AES-256-GCM), key in env/secret manager | Not stored (hash only, as today) |
| "See the password again" | Yes, decrypted for admins on request | No — admin clicks **Regenerate** to mint & reveal a fresh one |
| Meets "visible always, every device" | ✅ Fully | ⚠️ The *account* is always listed; the *password* is shown only at (re)generation |
| Breach blast radius | All un-purged passwords leak if DB **and** key leak | Nothing extra leaks (hashes only) |
| Complexity | Encryption lib + key management | Minimal |

**Recommendation: Option A**, with these mitigations, which keep the literal "always visible" behavior while limiting risk:

1. **Encrypt at rest** with AES-256-GCM; the key (`CREDENTIAL_ENC_KEY`) lives in the environment / Render secret, never in Mongo. DB dump alone cannot reveal passwords.
2. **Isolate** the ciphertext in its own `CredentialDelivery` collection so it is never fetched or logged by normal User reads.
3. **Retention knob** `CREDENTIAL_RETENTION` (default `until_removed` to match the ask; **recommended `until_first_login`**): purge the stored copy once the student has signed in — after that the student owns the password and the server no longer needs it.
4. **Encourage/force a password change on first login** so a stored copy goes stale.
5. **Audit** every reveal (`revealedCount`, `lastRevealedAt`) and never write the plaintext to logs.

The rest of this spec describes **Option A**. Option B is Option A minus the crypto/storage, plus `regenerate` as the only way to reveal — the endpoint shapes are otherwise identical, so the frontend is unaffected by the choice.

---

## Non-Goals

- Changing how students authenticate, or the bcrypt login hash. `passwordHash` stays the source of truth for login; the encrypted copy is display-only.
- A full secrets-management/KMS integration (env-held key is sufficient for v1; key rotation documented, not automated).
- Self-service password reset for students (separate feature).
- Paginating the approved list server-side (cohort is small; the client filters. Cursor pagination noted as an optional extension for parity with `students.ts`).

---

## Decisions

| Topic | Choice |
|---|---|
| Password-at-rest | AES-256-GCM, 256-bit key from `CREDENTIAL_ENC_KEY` |
| Storage location | New `CredentialDelivery` collection (isolated from `User`) |
| Reveal access | `GET /approved`, admin-only, decrypts on read, audited |
| Purge | `DELETE /approved/:id` (forget) + retention policy on first login |
| Recovery | `POST /:id/regenerate` mints a fresh password + email links |
| Direct send | `POST /approved/:id/send-email` via existing `nodemailer` (`lib/mailer.ts`) |
| Graceful degradation | If `CREDENTIAL_ENC_KEY` unset: accept still activates the user, credential is **not** stored, list returns `password: null` + a flag |
| Backfill | None destructive; pre-existing approved users show `password: null` until regenerated |

---

## Data Model

New collection, `src/models/CredentialDelivery.ts`:

```ts
{
  _id: ObjectId,
  userId: ObjectId,            // ref 'User', UNIQUE (one live credential per user)
  email: string,               // snapshot — lets the list/search work even if the User is later removed
  name: string,                // snapshot

  // AES-256-GCM parts (base64). All null once purged / retention elapsed / key absent.
  passwordCiphertext?: string,
  passwordIv?: string,         // 12 bytes
  passwordTag?: string,        // 16 bytes

  approvedByAdminId: ObjectId, // ref 'User' (the admin who approved) — audit
  approvedAt: Date,
  deliveredAt?: Date,          // set when server emails the credential
  revealedCount: number,       // default 0, ++ each time decrypted & returned
  lastRevealedAt?: Date,
  createdAt: Date, updatedAt: Date,   // timestamps: true
}
```

Index: `{ userId: 1 }` unique. Live profile fields (`age`, `gender`, `collegeName`, `course`) are **read from the current `User`** at list time (so edits show through); only `name`/`email` are snapshotted for resilience.

> **Alternative:** embed these fields under a `credential` sub-document on `User`. Simpler join, but mixes a secret into the hottest document and risks accidental over-fetch/logging. Prefer the separate collection.

---

## Crypto helper

`src/lib/credentialCrypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../env.js';

// 32-byte key, provided base64 or hex in CREDENTIAL_ENC_KEY.
function key(): Buffer | null {
  const raw = env().CREDENTIAL_ENC_KEY;
  if (!raw) return null;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : null;
}

export function credentialCryptoReady(): boolean { return key() !== null; }

export function encryptSecret(plain: string): { ciphertext: string; iv: string; tag: string } {
  const k = key(); if (!k) throw new Error('CREDENTIAL_ENC_KEY missing/invalid');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return { ciphertext: ct.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

export function decryptSecret(p: { ciphertext: string; iv: string; tag: string }): string {
  const k = key(); if (!k) throw new Error('CREDENTIAL_ENC_KEY missing/invalid');
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(p.iv, 'base64'));
  d.setAuthTag(Buffer.from(p.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(p.ciphertext, 'base64')), d.final()]).toString('utf8');
}
```

GCM authenticates the ciphertext — a tampered/ corrupted record throws on decrypt rather than returning garbage. **Key rotation** invalidates existing ciphertexts (they become unreadable → treated as `password: null`); document this and rotate only when acceptable.

---

## Endpoints

All under `/api/admin/access-requests`, already behind `requireAuth, requireRole('admin')`. Reuse `validateObjectId('id', …)`.

### 1. Modify `POST /:id/accept`

After the existing activate step, also persist the encrypted credential (best-effort — must not break approval):

```ts
// ...after User.updateOne({ status:'active', passwordHash })
try {
  if (credentialCryptoReady()) {
    const enc = encryptSecret(password);
    await CredentialDelivery.findOneAndUpdate(
      { userId: user._id },
      { $set: {
          email: user.email, name: user.name,
          passwordCiphertext: enc.ciphertext, passwordIv: enc.iv, passwordTag: enc.tag,
          approvedByAdminId: req.user!.id, approvedAt: new Date(),
          deliveredAt: null, revealedCount: 0, lastRevealedAt: null,
        } },
      { upsert: true, new: true },
    );
  } else {
    logger.warn('CREDENTIAL_ENC_KEY unset — approved credential not stored for %s', user._id);
  }
} catch (err) { logger.error('credential persist failed', err); /* swallow — approval already succeeded */ }
```

**Response unchanged** (still returns the one-time `{ id, email, name, password, mailtoSubject, mailtoBody, mailto, gmailUrl, loginUrl }`), so the current frontend keeps working during rollout. Optionally add `approvedAt`.

### 2. New `GET /approved`

Lists approved accounts **that have a stored credential**, newest first. Optional `?search=` (name/email substring, case-insensitive) — or omit and let the client filter (matches the Students page pattern).

Per item:

```ts
interface ApprovedAccount {
  id: string;                 // userId
  name: string;
  email: string;
  age?: number; gender?: 'male'|'female'|'other'; collegeName?: string; course?: string;
  approvedAt: string;         // ISO
  deliveredAt: string | null;
  password: string | null;    // decrypted; null if purged / key missing / undecryptable
  // rebuilt fresh each call via buildAcceptanceEmail (only when password present):
  loginUrl: string;
  mailtoSubject?: string; mailtoBody?: string; mailto?: string; gmailUrl?: string;
}
```

Logic: load `CredentialDelivery` docs (sorted `approvedAt desc`), join the live `User` for profile fields, decrypt the password (catch → `null`), rebuild email links when present, and bump `revealedCount`/`lastRevealedAt`. **This is the sensitive call** — it returns plaintext to the authenticated admin. Never log the body.

Response: `{ items: ApprovedAccount[] }`.

### 3. New `DELETE /approved/:id`  (server-side "Remove")

Purge the stored credential for a user — delete the `CredentialDelivery` doc (or null the three crypto fields). **Does not** delete or deactivate the student. Idempotent.

- 200 `{ ok: true }` on delete (or when already absent).

### 4. New `POST /:id/regenerate`  (recommended)

Mint a **fresh** password for an already-active user: generate → bcrypt into `passwordHash` → re-encrypt into `CredentialDelivery` → return the one-time plaintext + email links (same shape as `accept`). Use for "student lost password / credential was purged." This is also the reveal mechanism under Option B.

- 404 if no active user with that id. 200 with the accept-shaped payload.

### 5. New `POST /approved/:id/send-email`  (optional, recommended — SMTP already exists)

Server emails the credential directly via `sendMail` (`lib/mailer.ts`). Requires a present password (else 409 `CREDENTIAL_UNAVAILABLE` — regenerate first). On success set `deliveredAt = now`.

- 503 `SMTP_NOT_CONFIGURED` if `isMailConfigured()` is false; 200 `{ ok: true, deliveredAt }` otherwise.

### Retention hook (login)

In the login handler (`src/routes/auth.ts`), after a successful student login where `lastLoginAt` was previously unset (first login) **and** `CREDENTIAL_RETENTION === 'until_first_login'`, delete that user's `CredentialDelivery`. (Also acceptable: a lazy sweep in `GET /approved` that nulls records older than `CREDENTIAL_RETENTION_DAYS`.)

---

## Errors

Reuse existing codes (`NOT_FOUND` 404, `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `INTERNAL_ERROR` 500). New:

- `CREDENTIAL_UNAVAILABLE` (409) — send-email with no stored password.
- `SMTP_NOT_CONFIGURED` (503) — send-email without SMTP.

`accept` must **not** fail if encryption is unconfigured or persistence errors — it degrades to today's behavior (one-time reveal only).

---

## Environment

Add to `src/env.ts` (zod):

```ts
// 32-byte key as base64 (recommended) or 64-char hex. Optional: if unset,
// approved credentials are not stored and /approved returns password: null.
CREDENTIAL_ENC_KEY: z.string().min(1).optional(),
CREDENTIAL_RETENTION: z.enum(['until_removed', 'until_first_login']).default('until_removed'),
```

Generate a key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Add to `.env.example` and set on Render as `sync: false`. SMTP vars already exist.

---

## File Structure

**Backend (`shloka-backend/`):**
- Create: `src/models/CredentialDelivery.ts`
- Create: `src/lib/credentialCrypto.ts`
- Modify: `src/routes/admin/access-requests.ts` — persist on accept; add `GET /approved`, `DELETE /approved/:id`, `POST /:id/regenerate`, `POST /approved/:id/send-email`
- Modify: `src/routes/auth.ts` — first-login retention purge
- Modify: `src/env.ts`, `.env.example`, `render.yaml`
- Create tests: `tests/credentialCrypto.test.ts`, `tests/access-requests-approved.integration.test.ts`

**Frontend (`kayachikitsasutrani/`):**
- Modify: `src/lib/auth/types.ts` — add `ApprovedAccount`
- Modify: `src/lib/api.ts` — `accessRequests.approved()`, `.forget(id)`, `.regenerate(id)`, `.sendEmail(id)`
- Modify: `src/app/admin/access-requests/AccessRequestsPage.tsx` — source the Approved tab from `approved()` instead of `localStorage`; `Remove` → `forget(id)`; after `accept`, refetch (or optimistically insert). Drop the `localStorage` approval cache (`APPROVED_KEY`, `readApproved`/`writeApproved`); keep `VIEW_KEY` (tab/search persistence). Tabs/search/cards stay as-is — passwords now come from the server and are visible on every device.

---

## Testing (Vitest + supertest + mongodb-memory-server)

**Unit — `credentialCrypto.test.ts`:** encrypt→decrypt round-trip; tampering the ciphertext/tag throws; missing key → `credentialCryptoReady()` false and encrypt throws.

**Integration — `access-requests-approved.integration.test.ts`:**
- accept stores an encrypted credential; `GET /approved` returns `password` equal to the one-time plaintext from accept.
- `GET /approved` is admin-only: student → 403, anon → 401.
- `DELETE /approved/:id` nulls the credential; next `GET /approved` → `password: null`; the user is still `active` and can still log in with the original password.
- `regenerate` returns a new password; login with the **old** fails and with the **new** succeeds; `GET /approved` shows the new one.
- retention `until_first_login`: after the student's first login, the credential is purged (`password: null`).
- key absent: accept still activates the user (200, one-time password returned); `GET /approved` returns `password: null` (no crash).
- `send-email` without SMTP → 503; with SMTP (mocked transporter) → 200 and `deliveredAt` set.
- reject still deletes the pending user and leaves no `CredentialDelivery`.

---

## Rollout

1. Ship **backend** first (additive; accept response unchanged → old frontend keeps working). Set `CREDENTIAL_ENC_KEY` on Render before/at deploy; without it the feature no-ops safely.
2. Ship **frontend**: Approved tab reads from `/approved`. Existing admins lose the per-browser `localStorage` list, but any account approved after the backend deploy appears for everyone. Pre-existing approved students show `password: null` → use **Regenerate** to issue a shareable password.
3. Optional later: switch `CREDENTIAL_RETENTION` to `until_first_login`, and/or add a "force password change on first login" flag.

---

## Security Notes

- Plaintext password only ever exists in: the HTTP response to an authenticated admin, and the AES-GCM ciphertext (needs the env key to read). Never in logs.
- `CredentialDelivery` is a separate collection — normal `User` reads never touch it.
- Key stored in env/Render secret, not Mongo; DB dump alone is insufficient to decrypt.
- Audit via `revealedCount` / `lastRevealedAt` / `approvedByAdminId`; consider an admin audit log later.
- Prefer `until_first_login` retention + first-login password change to minimize the window a recoverable password exists.
- If recoverable storage is ever deemed unacceptable, drop to **Option B** (no stored password; `regenerate` reveals) — same endpoints, `password` simply always `null` until a regenerate call.
