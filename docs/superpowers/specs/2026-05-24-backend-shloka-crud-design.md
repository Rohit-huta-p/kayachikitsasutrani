# Backend Shloka CRUD + Cloudinary Uploads

**Status:** Draft
**Date:** 2026-05-24
**Scope:** Sub-project 2 of the multi-phase backend buildout. Adds shloka content model + CRUD endpoints + audio/image upload to Cloudinary.
**Repo:** `shloka-backend/` (additive). No frontend changes in this sub-project — frontend stays on `/public/data/*.json` files until sub-project 3 (admin UI) cuts it over.

## Goal

Stand up the backend surface that the admin UI (sub-project 3) will consume:

1. Store shlokas in MongoDB (replacing the per-file JSON pattern).
2. Admin endpoints to create, list, view, update, delete shlokas.
3. Audio and image uploads via Cloudinary (backend-proxied; admin's browser uploads to backend, backend forwards to Cloudinary using server credentials).
4. Public endpoints (login-required, any role) to list and fetch published shlokas. Drafts are admin-only.

After this sub-project ships, an operator can use curl/Postman to create a shloka end-to-end: upload audio → upload image → POST shloka → publish → GET as a student.

## Non-Goals

- No admin UI — sub-project 3.
- No frontend changes — sub-project 3 cuts the shloka detail page over from JSON files to the API.
- No tags, categories, difficulty, search, or pagination beyond a simple cursor.
- No multi-language translation support.
- No edit history / versioning.
- No soft delete — hard delete only; Cloudinary assets are destroyed on shloka delete.
- No visual word-timing editor — admin posts word timing arrays in the request body. The visual editor is a sub-project 3 feature.
- No migration script. Old `/public/data/*.json` files remain served by Next.js statically; cutover happens in sub-project 3.
- No rate limiting beyond what was in sub-project 1's scope.

## Constraints

- Backend repo only (`shloka-backend/`). Frontend untouched.
- Cloudinary free tier (25GB storage, 25GB monthly bandwidth) — adequate for a small library + low admin volume.
- Audio asset class on Cloudinary uses `resource_type: 'video'` (SDK quirk). Wrapper hides this.
- Backend proxy upload — admin's multipart request hits backend, backend pipes to Cloudinary. Render free tier bandwidth allowance is generous enough for admin volume.

## Decisions

| Topic | Choice |
|---|---|
| Read access | Authenticated users only (any role) |
| Draft visibility | Public read returns 404 for drafts; admin sees all |
| Upload approach | Backend proxy via multer (memory storage) |
| Audio max size | 20 MB |
| Image max size | 5 MB |
| Audio MIME allowlist | `audio/mpeg`, `audio/mp3`, `audio/wav` |
| Image MIME allowlist | `image/jpeg`, `image/png`, `image/webp` |
| Delete behavior | Hard delete; Cloudinary destroy for each asset |
| Tags / categories | Deferred |
| Migration | None; old JSON files stay until sub-project 3 cutover |
| Routing | Split routers: `/api/shlokas` (public reads), `/api/admin/shlokas` (CRUD), `/api/admin/uploads/...` (file uploads) |
| Slug | Author-provided, unique, lowercase kebab-case |
| Versioning | None |

## Architecture

### File layout (additions)

```
shloka-backend/src/
├── models/
│   └── Shloka.ts                   Mongoose schema + model
├── lib/
│   ├── cloudinary.ts               uploadBuffer, deleteAsset
│   ├── publicShloka.ts             ShlokaDoc → PublicShloka mapper
│   └── slug.ts                     kebab-case slug validator
├── middleware/
│   └── upload.ts                   multer instance (memory storage, size/mime gates)
├── routes/
│   ├── shlokas.ts                  GET /, GET /:slug  (requireAuth, published only)
│   └── admin/
│       ├── shlokas.ts              full CRUD (requireAuth + requireRole('admin'))
│       └── uploads.ts              POST /audio, POST /image
└── env.ts                          add CLOUDINARY_CLOUD_NAME, _API_KEY, _API_SECRET (zod-validated)
```

Tests:
```
shloka-backend/tests/
├── shlokas.integration.test.ts     public + admin read paths
├── adminShlokas.integration.test.ts CRUD lifecycle
├── uploads.integration.test.ts     multer + cloudinary (mocked)
├── cloudinary.test.ts              wrapper unit tests
└── slug.test.ts                    slug validation
```

## Data Model

### Shloka collection

```ts
// Mongoose schema, simplified
{
  _id: ObjectId,
  slug: string,                       // unique, lowercase kebab-case
  title: string,                      // 1..200
  meaning: string,                    // 1..5000
  translation: string,                // 1..5000
  status: 'draft' | 'published',      // default 'draft'
  audio: {
    full: { url: string, publicId: string },
    lines: [
      { url: string, publicId: string }
    ],
  },
  image?: { url: string, publicId: string },
  lines: [
    {
      sanskrit: string,               // 1..1000
      transliteration: string,        // 0..1000
      words: [
        { text: string, start: number, end: number }
      ],
      fullTimings: [
        { text: string, start: number, end: number }
      ],
    }
  ],
  createdBy: ObjectId,                // User ref
  createdAt: Date,                    // auto
  updatedAt: Date,                    // auto
}
```

Indexes:
- `{ slug: 1 }` unique
- `{ status: 1, createdAt: -1 }` for public listing

Validation invariants enforced by zod + custom checks at API boundary:
- `audio.lines.length === lines.length` (one MP3 per line)
- For each line, `lines[i].words.length === lines[i].fullTimings.length` (same words, different time bases)
- For each line, the `text` of `words[k]` equals the `text` of `fullTimings[k]` (parallel arrays)
- Each timing array must be sorted by `start` with `start < end` for every entry, and adjacent entries non-overlapping (entry k's `end` ≤ entry k+1's `start`)

### Public shape

```ts
interface PublicShloka {
  id: string;
  slug: string;
  title: string;
  meaning: string;
  translation: string;
  status: 'draft' | 'published';
  audio: {
    full: { url: string };           // publicId stripped — not needed by frontend
    lines: { url: string }[];
  };
  image?: { url: string };
  lines: Array<{
    sanskrit: string;
    transliteration: string;
    words: { text: string; start: number; end: number }[];
    fullTimings: { text: string; start: number; end: number }[];
  }>;
  createdAt: string;                  // ISO
  updatedAt: string;                  // ISO
}
```

`createdBy` and `publicId` fields are intentionally omitted from public responses.

## Endpoints

All under `/api`. JSON in/out. Error shape: `{ error: { code, message } }`.

### Public reads (require auth, any role)

#### `GET /api/shlokas`

Query params:
- `limit` (1..50, default 20)
- `cursor` (opaque base64 of `{createdAt, _id}` from last item)

Returns:
```ts
{
  items: PublicShloka[],
  nextCursor?: string,
}
```

Only `status: 'published'` shlokas are returned.

#### `GET /api/shlokas/:slug`

Path param: slug.

Returns: `PublicShloka` (200) or `{ error: { code: 'NOT_FOUND', ... } }` (404).

Drafts return 404 even though they exist — admins use the admin endpoint for drafts.

### Admin endpoints (require auth + admin role)

#### `GET /api/admin/shlokas`

Query params:
- `status` = `draft | published | all` (default `all`)
- `limit`, `cursor` same as public

Returns `{ items: PublicShloka[], nextCursor? }`. Sees drafts.

#### `GET /api/admin/shlokas/:id`

Path param: Mongo `_id`. Returns `PublicShloka` (200) or 404.

#### `POST /api/admin/shlokas`

Body (zod-validated):
```ts
{
  slug: string,                       // kebab-case, unique
  title: string,
  meaning: string,
  translation: string,
  status?: 'draft' | 'published',     // default 'draft'
  audio: {
    full: { url: string, publicId: string },
    lines: { url: string, publicId: string }[],
  },
  image?: { url: string, publicId: string },
  lines: [
    {
      sanskrit: string,
      transliteration: string,
      words: { text: string, start: number, end: number }[],
      fullTimings: { text: string, start: number, end: number }[],
    }
  ],
}
```

Returns: 200 with `PublicShloka`. 409 `SLUG_TAKEN` on duplicate.

`createdBy` is set from `req.user.id`.

#### `PATCH /api/admin/shlokas/:id`

Partial body — any subset of the create body. Slug can be changed (re-validates uniqueness).

Returns: `PublicShloka` (200), 404 if not found, 409 on slug conflict.

#### `DELETE /api/admin/shlokas/:id`

1. Look up the shloka.
2. If found, delete from Mongo.
3. For each asset (`audio.full`, each `audio.lines[i]`, `image` if present), call Cloudinary destroy.
4. Cloudinary failures are logged but do NOT fail the response — orphan cleanup is the operator's problem if it happens.

Returns: `{ ok: true }` (200) or 404.

### Upload endpoints (require auth + admin role)

#### `POST /api/admin/uploads/audio`

Multipart, field name `file`.

Validates:
- MIME in `['audio/mpeg', 'audio/mp3', 'audio/wav']`
- Size ≤ 20 MB

Uploads to Cloudinary folder `shlokas/audio/` with `resource_type: 'video'` (SDK requirement for audio).

Returns:
```ts
{
  url: string,
  publicId: string,
  duration?: number,                  // seconds, if Cloudinary returns it
}
```

#### `POST /api/admin/uploads/image`

Multipart, field name `file`.

Validates:
- MIME in `['image/jpeg', 'image/png', 'image/webp']`
- Size ≤ 5 MB

Uploads to `shlokas/images/` with `resource_type: 'image'`.

Returns:
```ts
{
  url: string,
  publicId: string,
  width: number,
  height: number,
}
```

## Cloudinary Wrapper

```ts
// src/lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../env.js';

let configured = false;
function ensureConfig() {
  if (configured) return;
  const e = env();
  cloudinary.config({
    cloud_name: e.CLOUDINARY_CLOUD_NAME,
    api_key: e.CLOUDINARY_API_KEY,
    api_secret: e.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
}

export async function uploadBuffer(
  buf: Buffer,
  folder: string,
  resourceType: 'image' | 'video',
): Promise<UploadResult> {
  ensureConfig();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary returned no result'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          duration: result.duration,
        });
      },
    );
    stream.end(buf);
  });
}

export async function deleteAsset(publicId: string, resourceType: 'image' | 'video'): Promise<void> {
  ensureConfig();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
```

In tests, the `cloudinary` module is mocked so no real network calls happen.

## Multer Setup

```ts
// src/middleware/upload.ts
import multer from 'multer';

const AUDIO_MAX = 20 * 1024 * 1024;
const IMAGE_MAX = 5 * 1024 * 1024;

const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav']);
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AUDIO_MAX },
  fileFilter: (_req, file, cb) =>
    AUDIO_MIMES.has(file.mimetype) ? cb(null, true) : cb(new Error('UNSUPPORTED_MIME')),
}).single('file');

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX },
  fileFilter: (_req, file, cb) =>
    IMAGE_MIMES.has(file.mimetype) ? cb(null, true) : cb(new Error('UNSUPPORTED_MIME')),
}).single('file');
```

Multer errors get caught and mapped:
- `LIMIT_FILE_SIZE` → 413 `FILE_TOO_LARGE`
- `UNSUPPORTED_MIME` → 415 `UNSUPPORTED_MEDIA_TYPE`
- missing field `file` → 400 `MISSING_FILE`

## Error Codes

Additions to the table from sub-project 1:

| Code | HTTP | Where |
|---|---|---|
| `NOT_FOUND` | 404 | shloka missing |
| `SLUG_TAKEN` | 409 | slug collision on create/update |
| `FILE_TOO_LARGE` | 413 | multer size limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | mime gate |
| `MISSING_FILE` | 400 | multipart with no `file` field |
| `CLOUDINARY_FAILED` | 502 | upload failed after retry |
| `INVALID_TIMINGS` | 400 | overlapping/unsorted/word-count mismatch |

## Environment Variables (additions)

```bash
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

All three required; zod validates at startup.

## Testing

Vitest + supertest + `mongodb-memory-server`. Cloudinary SDK mocked via `vi.mock('cloudinary')`.

**Unit (`tests/slug.test.ts`):** validateSlug accepts kebab-case, rejects spaces/caps/leading-hyphen/empty.

**Unit (`tests/cloudinary.test.ts`):** uploadBuffer resolves with SDK result; deleteAsset calls destroy with right args. Configured once.

**Integration (`tests/uploads.integration.test.ts`):**
- POST audio with valid MP3 → 200, returns url + publicId
- POST audio over 20MB → 413
- POST audio with wrong MIME (e.g. `text/plain`) → 415
- POST audio without `file` field → 400
- POST audio without admin role → 403
- POST audio without auth → 401
- Same matrix for image endpoint

**Integration (`tests/adminShlokas.integration.test.ts`):**
- POST shloka (admin) → 200, status defaults to `draft`, `createdBy` set
- POST with duplicate slug → 409
- POST with overlapping word timings → 400 `INVALID_TIMINGS`
- POST with mismatched `audio.lines.length` vs `lines.length` → 400
- GET /admin/shlokas → returns drafts + published
- GET /admin/shlokas/:id → returns by id
- PATCH /admin/shlokas/:id → updates fields, including slug
- PATCH with slug colliding with another shloka → 409
- DELETE /admin/shlokas/:id → 200 + Cloudinary destroy called for each asset (assert mock calls)
- DELETE Cloudinary failure → still returns 200 (logged)

**Integration (`tests/shlokas.integration.test.ts`):**
- GET /shlokas without auth → 401
- GET /shlokas as student → only published items
- GET /shlokas as admin → also only published (admin uses /admin endpoint for drafts)
- GET /shlokas/:slug published → 200
- GET /shlokas/:slug draft → 404 (even for admin — they use /admin/shlokas/:id with id)
- GET /shlokas?limit=2&cursor=... → pagination works

## Render Deploy

`render.yaml` needs three more env vars added with `sync: false`:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Operator sets these in Render dashboard. They come from Cloudinary console under "Account Details".

README gets a new "Cloudinary setup" section:
1. Sign up at cloudinary.com (free tier).
2. Copy cloud name, API key, API secret from dashboard.
3. Set as env vars locally and on Render.

## Security Notes

- File upload validation happens BEFORE multer accepts the buffer (mime + size via multer config).
- Upload endpoints are admin-only — no anonymous file uploads.
- Stored URLs are Cloudinary's signed `secure_url` (https).
- Slug input is validated against a strict kebab-case regex to prevent path injection in future URL constructions.
- Public endpoints (auth-required) leak nothing about drafts (404 not 403 for draft slugs — to avoid revealing draft slug existence).
- `createdBy` field is server-set from `req.user.id`, never from request body.
- Cloudinary publicId is never returned to public callers — only admin responses include it (needed for the delete flow in admin UI).
- Admin endpoints don't accept arbitrary `createdAt` / `updatedAt` overrides.

## Open Items (acceptable to defer)

- Cloudinary upload retry policy: v1 retries once on 502; configurable later.
- Pagination polish: cursor encoding scheme is simple base64 of `{createdAt, _id}`. Switch to keyset if needed.
- Bulk import endpoint (CSV/JSON): later.
- Rate limiting on upload endpoint: add when admin UI exists and there's risk of accidental loops.
