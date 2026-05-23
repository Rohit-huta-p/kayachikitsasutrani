# Backend Shloka CRUD + Cloudinary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend endpoints for shloka content management (Mongo CRUD), backend-proxied audio + image uploads to Cloudinary, and login-required public reads with draft visibility for admins.

**Architecture:** Express routers split by audience: `/api/shlokas` for authenticated readers (published only), `/api/admin/shlokas` and `/api/admin/uploads/*` for admins. A Mongoose `Shloka` model stores text + audio URLs + word timings. A thin Cloudinary wrapper hides the `resource_type: 'video'` quirk for audio. Multer in memory mode + zod-validated bodies keep file handling safe.

**Tech Stack:** Adds `cloudinary` SDK + `multer` to existing Node 20 + Express 4 + TypeScript + Mongoose 8 + zod + Vitest stack.

**Spec:** `docs/superpowers/specs/2026-05-24-backend-shloka-crud-design.md`

**Working directory:** `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend/` (existing repo on branch `main`)

---

## File Structure

**Create:**
- `src/lib/cloudinary.ts` — `uploadBuffer`, `deleteAsset`
- `src/lib/publicShloka.ts` — `PublicShloka` type + `toPublicShloka` mapper
- `src/lib/slug.ts` — `isValidSlug` predicate
- `src/lib/cursor.ts` — `encodeCursor`, `decodeCursor` for keyset pagination
- `src/middleware/upload.ts` — multer instances + error mapper
- `src/models/Shloka.ts` — Mongoose schema + model
- `src/routes/admin/uploads.ts` — POST `/audio`, POST `/image`
- `src/routes/admin/shlokas.ts` — admin CRUD
- `src/routes/shlokas.ts` — public reads
- `tests/cloudinary.test.ts`
- `tests/slug.test.ts`
- `tests/cursor.test.ts`
- `tests/uploads.integration.test.ts`
- `tests/adminShlokas.integration.test.ts`
- `tests/shlokas.integration.test.ts`
- `__mocks__/cloudinary.ts` (vitest module mock)

**Modify:**
- `package.json` — add `cloudinary`, `multer`, `@types/multer`
- `src/env.ts` + `tests/env.test.ts` — add `CLOUDINARY_*` vars
- `src/server.ts` — mount three new routers
- `render.yaml` — add three env vars
- `README.md` — add Cloudinary setup section + new API table rows

---

## Task 1: Install Cloudinary + Multer Deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd /Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend
npm install cloudinary@^2.5.1 multer@^1.4.5-lts.1
```

- [ ] **Step 2: Install types**

```bash
npm install --save-dev @types/multer@^1.4.12
```

- [ ] **Step 3: Verify install + types compile**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cloudinary + multer deps"
```

---

## Task 2: Extend Env Loader with Cloudinary Vars

**Files:**
- Modify: `src/env.ts`
- Modify: `tests/env.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update test fixture and add validation tests**

Open `tests/env.test.ts`. Find the `VALID` constant and replace it with:

```ts
const VALID = {
  NODE_ENV: 'development',
  PORT: '4000',
  MONGO_URI: 'mongodb://localhost:27017/shloka',
  JWT_SECRET: 'a'.repeat(32),
  FRONTEND_ORIGIN: 'http://localhost:3000',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'verystrong',
  ADMIN_NAME: 'Admin',
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: '123456789012345',
  CLOUDINARY_API_SECRET: 'secretsecretsecret',
};
```

Add two new test cases at the end of the `describe` block, before its closing `});`:

```ts
  it('throws on missing CLOUDINARY_CLOUD_NAME', () => {
    const bad = { ...VALID, CLOUDINARY_CLOUD_NAME: undefined } as unknown as Record<string, string>;
    expect(() => parseEnv(bad)).toThrow();
  });

  it('exposes CLOUDINARY_API_SECRET', () => {
    const env = parseEnv(VALID);
    expect(env.CLOUDINARY_API_SECRET).toBe('secretsecretsecret');
  });
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- env
```

Expected: FAIL — CLOUDINARY vars not in schema.

- [ ] **Step 3: Update `src/env.ts` schema**

Open `src/env.ts` and replace the `schema` constant with:

```ts
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  FRONTEND_ORIGIN: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_NAME: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- env
npx tsc --noEmit
```

Expected: 6 tests pass, tsc clean.

- [ ] **Step 5: Update `.env.example`**

Append to `.env.example`:

```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

- [ ] **Step 6: Commit**

```bash
git add src/env.ts tests/env.test.ts .env.example
git commit -m "feat: add Cloudinary env vars to env loader"
```

---

## Task 3: Slug Validator

**Files:**
- Create: `src/lib/slug.ts`
- Create: `tests/slug.test.ts`

- [ ] **Step 1: Write failing test**

Path: `tests/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isValidSlug } from '../src/lib/slug.js';

describe('isValidSlug', () => {
  it('accepts simple lowercase words', () => {
    expect(isValidSlug('taruna-jwara')).toBe(true);
    expect(isValidSlug('shloka')).toBe(true);
    expect(isValidSlug('nava-jwara-chikitsa')).toBe(true);
  });

  it('accepts digits in slug', () => {
    expect(isValidSlug('shloka-142')).toBe(true);
    expect(isValidSlug('chapter-1-shloka-2')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });

  it('rejects uppercase', () => {
    expect(isValidSlug('Taruna-Jwara')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidSlug('taruna jwara')).toBe(false);
  });

  it('rejects leading or trailing hyphen', () => {
    expect(isValidSlug('-taruna')).toBe(false);
    expect(isValidSlug('taruna-')).toBe(false);
  });

  it('rejects double hyphens', () => {
    expect(isValidSlug('taruna--jwara')).toBe(false);
  });

  it('rejects path-like characters', () => {
    expect(isValidSlug('taruna/jwara')).toBe(false);
    expect(isValidSlug('../etc')).toBe(false);
    expect(isValidSlug('taruna.jwara')).toBe(false);
  });

  it('rejects unicode word chars', () => {
    expect(isValidSlug('शloka')).toBe(false);
  });

  it('enforces length 1..80', () => {
    expect(isValidSlug('a')).toBe(true);
    expect(isValidSlug('a'.repeat(80))).toBe(true);
    expect(isValidSlug('a'.repeat(81))).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- slug
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Path: `src/lib/slug.ts`:

```ts
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (s.length < 1 || s.length > 80) return false;
  return SLUG_RE.test(s);
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- slug
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/slug.test.ts
git commit -m "feat: add slug validator with kebab-case + safe-char rules"
```

---

## Task 4: Cursor Encoder

Used by pagination on both public and admin shloka lists.

**Files:**
- Create: `src/lib/cursor.ts`
- Create: `tests/cursor.test.ts`

- [ ] **Step 1: Write failing test**

Path: `tests/cursor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '../src/lib/cursor.js';

describe('cursor', () => {
  it('encodes and decodes a cursor', () => {
    const c = { createdAt: '2026-05-24T10:00:00.000Z', id: '507f1f77bcf86cd799439011' };
    const token = encodeCursor(c);
    expect(typeof token).toBe('string');
    expect(decodeCursor(token)).toEqual(c);
  });

  it('decodeCursor returns null for empty input', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('decodeCursor returns null for malformed input', () => {
    expect(decodeCursor('not-base64!!!')).toBeNull();
    expect(decodeCursor(Buffer.from('not json').toString('base64'))).toBeNull();
  });

  it('decodeCursor returns null when shape is wrong', () => {
    const bad = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64');
    expect(decodeCursor(bad)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- cursor
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Path: `src/lib/cursor.ts`:

```ts
export interface Cursor {
  createdAt: string; // ISO
  id: string;        // ObjectId hex
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

export function decodeCursor(token: string | undefined): Cursor | null {
  if (!token) return null;
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string'
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- cursor
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cursor.ts tests/cursor.test.ts
git commit -m "feat: keyset pagination cursor encode/decode"
```

---

## Task 5: Cloudinary Wrapper

**Files:**
- Create: `src/lib/cloudinary.ts`
- Create: `__mocks__/cloudinary.ts`
- Create: `tests/cloudinary.test.ts`

- [ ] **Step 1: Write the mock**

Path: `__mocks__/cloudinary.ts`:

```ts
import { vi } from 'vitest';

const uploadStreamMock = vi.fn((options, callback) => {
  return {
    end: (buf: Buffer) => {
      callback(null, {
        secure_url: `https://res.cloudinary.com/demo/${options.resource_type}/upload/${options.folder}/mock-${buf.length}`,
        public_id: `${options.folder}/mock-${Date.now()}`,
        width: options.resource_type === 'image' ? 800 : undefined,
        height: options.resource_type === 'image' ? 600 : undefined,
        duration: options.resource_type === 'video' ? 12.3 : undefined,
      });
    },
  };
});

const destroyMock = vi.fn(async () => ({ result: 'ok' }));

export const __mocks = { uploadStreamMock, destroyMock };

export const v2 = {
  config: vi.fn(),
  uploader: {
    upload_stream: uploadStreamMock,
    destroy: destroyMock,
  },
};
```

- [ ] **Step 2: Write failing test**

Path: `tests/cloudinary.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('cloudinary', async () => await import('../__mocks__/cloudinary.js'));

import { uploadBuffer, deleteAsset } from '../src/lib/cloudinary.js';
import { __mocks } from '../__mocks__/cloudinary.js';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';
  process.env.MONGO_URI = 'mongodb://localhost:27017/test';
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
  process.env.ADMIN_EMAIL = 'a@b.c';
  process.env.ADMIN_PASSWORD = 'password123';
  process.env.ADMIN_NAME = 'A';
  process.env.CLOUDINARY_CLOUD_NAME = 'demo';
  process.env.CLOUDINARY_API_KEY = '123';
  process.env.CLOUDINARY_API_SECRET = 'sssss';
  __mocks.uploadStreamMock.mockClear();
  __mocks.destroyMock.mockClear();
});

describe('cloudinary wrapper', () => {
  it('uploadBuffer returns url + publicId', async () => {
    const buf = Buffer.from('fake');
    const result = await uploadBuffer(buf, 'shlokas/audio', 'video');
    expect(result.url).toContain('res.cloudinary.com');
    expect(result.publicId).toContain('shlokas/audio/');
    expect(result.duration).toBe(12.3);
  });

  it('uploadBuffer image returns width/height', async () => {
    const result = await uploadBuffer(Buffer.from('x'), 'shlokas/images', 'image');
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('deleteAsset calls destroy with publicId + resource_type', async () => {
    await deleteAsset('shlokas/audio/foo', 'video');
    expect(__mocks.destroyMock).toHaveBeenCalledWith('shlokas/audio/foo', { resource_type: 'video' });
  });
});
```

- [ ] **Step 3: Run, confirm fail**

```bash
npm test -- cloudinary
```

Expected: FAIL — wrapper not found.

- [ ] **Step 4: Write the implementation**

Path: `src/lib/cloudinary.ts`:

```ts
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../env.js';

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
}

let configured = false;
function ensureConfig(): void {
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
        if (err || !result) {
          reject(err ?? new Error('Cloudinary returned no result'));
          return;
        }
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

- [ ] **Step 5: Run, confirm pass**

```bash
npm test -- cloudinary
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cloudinary.ts __mocks__/cloudinary.ts tests/cloudinary.test.ts
git commit -m "feat: cloudinary wrapper with upload_stream + destroy"
```

---

## Task 6: Multer Middleware

**Files:**
- Create: `src/middleware/upload.ts`

No standalone test — exercised by upload integration tests in Task 9.

- [ ] **Step 1: Write the file**

Path: `src/middleware/upload.ts`:

```ts
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

const AUDIO_MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav']);
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AUDIO_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (AUDIO_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('UNSUPPORTED_MIME'));
  },
}).single('file');

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('UNSUPPORTED_MIME'));
  },
}).single('file');

/**
 * Wraps a multer middleware so its errors return clean JSON
 * with our error code shape instead of crashing.
 */
export function handleUpload(middleware: ReturnType<typeof multer>['single'] | typeof audioUpload) {
  return (req: Request, res: Response, next: NextFunction): void => {
    middleware(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds size limit' } });
          return;
        }
        res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: err.message } });
        return;
      }
      if (err instanceof Error && err.message === 'UNSUPPORTED_MIME') {
        res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'File type not allowed' } });
        return;
      }
      if (err) {
        next(err);
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: { code: 'MISSING_FILE', message: 'No file uploaded under field "file"' } });
        return;
      }
      next();
    });
  };
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/middleware/upload.ts
git commit -m "feat: multer middleware with size + mime gates and clean error mapping"
```

---

## Task 7: Shloka Model

**Files:**
- Create: `src/models/Shloka.ts`

No standalone test. Exercised by integration tests in Tasks 9–12.

- [ ] **Step 1: Write the file**

Path: `src/models/Shloka.ts`:

```ts
import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from 'mongoose';

const wordTimingSchema = new Schema(
  {
    text: { type: String, required: true },
    start: { type: Number, required: true, min: 0 },
    end: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const lineSchema = new Schema(
  {
    sanskrit: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    transliteration: { type: String, default: '', trim: true, maxlength: 1000 },
    words: { type: [wordTimingSchema], default: [] },
    fullTimings: { type: [wordTimingSchema], default: [] },
  },
  { _id: false },
);

const assetSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const audioSchema = new Schema(
  {
    full: { type: assetSchema, required: true },
    lines: { type: [assetSchema], default: [] },
  },
  { _id: false },
);

const shlokaSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    meaning: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
    translation: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
    status: { type: String, enum: ['draft', 'published'], required: true, default: 'draft', index: true },
    audio: { type: audioSchema, required: true },
    image: { type: assetSchema },
    lines: { type: [lineSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

shlokaSchema.index({ status: 1, createdAt: -1 });

export type ShlokaDoc = HydratedDocument<InferSchemaType<typeof shlokaSchema>>;

export const Shloka = model('Shloka', shlokaSchema);

export const ObjectId = Types.ObjectId;
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/models/Shloka.ts
git commit -m "feat: Shloka mongoose model with timing + asset sub-schemas"
```

---

## Task 8: PublicShloka Mapper

**Files:**
- Create: `src/lib/publicShloka.ts`

No standalone test — verified via integration tests by inspecting JSON response shape.

- [ ] **Step 1: Write the file**

Path: `src/lib/publicShloka.ts`:

```ts
import type { ShlokaDoc } from '../models/Shloka.js';

export interface PublicWordTiming {
  text: string;
  start: number;
  end: number;
}

export interface PublicShlokaLine {
  sanskrit: string;
  transliteration: string;
  words: PublicWordTiming[];
  fullTimings: PublicWordTiming[];
}

export interface PublicShlokaAsset {
  url: string;
  publicId?: string; // present only in admin responses
}

export interface PublicShloka {
  id: string;
  slug: string;
  title: string;
  meaning: string;
  translation: string;
  status: 'draft' | 'published';
  audio: {
    full: PublicShlokaAsset;
    lines: PublicShlokaAsset[];
  };
  image?: PublicShlokaAsset;
  lines: PublicShlokaLine[];
  createdAt: string;
  updatedAt: string;
}

export interface ToPublicOpts {
  includePublicIds?: boolean; // admin responses set true
}

export function toPublicShloka(doc: ShlokaDoc, opts: ToPublicOpts = {}): PublicShloka {
  const includeIds = opts.includePublicIds ?? false;
  const mapAsset = (a: { url: string; publicId: string }): PublicShlokaAsset =>
    includeIds ? { url: a.url, publicId: a.publicId } : { url: a.url };

  return {
    id: doc._id.toString(),
    slug: doc.slug,
    title: doc.title,
    meaning: doc.meaning,
    translation: doc.translation,
    status: doc.status as 'draft' | 'published',
    audio: {
      full: mapAsset(doc.audio.full),
      lines: doc.audio.lines.map(mapAsset),
    },
    image: doc.image ? mapAsset(doc.image) : undefined,
    lines: doc.lines.map((l) => ({
      sanskrit: l.sanskrit,
      transliteration: l.transliteration ?? '',
      words: l.words.map((w) => ({ text: w.text, start: w.start, end: w.end })),
      fullTimings: l.fullTimings.map((w) => ({ text: w.text, start: w.start, end: w.end })),
    })),
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
  };
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/publicShloka.ts
git commit -m "feat: PublicShloka mapper with admin/public publicId gating"
```

---

## Task 9: Upload Routes + Integration Tests

**Files:**
- Create: `src/routes/admin/uploads.ts`
- Create: `tests/uploads.integration.test.ts`
- Modify: `src/server.ts` (mount `/api/admin/uploads`)

- [ ] **Step 1: Write the failing integration test**

Path: `tests/uploads.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

vi.mock('cloudinary', async () => await import('../__mocks__/cloudinary.js'));

import { buildApp } from '../src/server.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/lib/password.js';
import { signSession } from '../src/lib/jwt.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof buildApp>;
let adminCookie: string;
let studentCookie: string;

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

beforeEach(async () => {
  await User.deleteMany({});
  const admin = await User.create({
    email: 'admin@x.test',
    passwordHash: await hashPassword('password1'),
    role: 'admin',
    name: 'Admin',
  });
  const student = await User.create({
    email: 'student@x.test',
    passwordHash: await hashPassword('password1'),
    role: 'student',
    name: 'Student',
  });
  adminCookie = `sht_session=${signSession(admin._id.toString(), 'a'.repeat(32))}`;
  studentCookie = `sht_session=${signSession(student._id.toString(), 'a'.repeat(32))}`;
});

describe('POST /api/admin/uploads/audio', () => {
  it('admin uploads mp3 → 200 with url + publicId', async () => {
    const res = await request(app)
      .post('/api/admin/uploads/audio')
      .set('Cookie', adminCookie)
      .attach('file', Buffer.from('fake mp3 bytes'), { filename: 'a.mp3', contentType: 'audio/mpeg' });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('res.cloudinary.com');
    expect(res.body.publicId).toContain('shlokas/audio/');
    expect(res.body.duration).toBe(12.3);
  });

  it('student → 403', async () => {
    const res = await request(app)
      .post('/api/admin/uploads/audio')
      .set('Cookie', studentCookie)
      .attach('file', Buffer.from('x'), { filename: 'a.mp3', contentType: 'audio/mpeg' });
    expect(res.status).toBe(403);
  });

  it('unauth → 401', async () => {
    const res = await request(app)
      .post('/api/admin/uploads/audio')
      .attach('file', Buffer.from('x'), { filename: 'a.mp3', contentType: 'audio/mpeg' });
    expect(res.status).toBe(401);
  });

  it('wrong mime → 415', async () => {
    const res = await request(app)
      .post('/api/admin/uploads/audio')
      .set('Cookie', adminCookie)
      .attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('missing file field → 400', async () => {
    const res = await request(app)
      .post('/api/admin/uploads/audio')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FILE');
  });

  it('over size limit → 413', async () => {
    const big = Buffer.alloc(21 * 1024 * 1024); // 21 MB
    const res = await request(app)
      .post('/api/admin/uploads/audio')
      .set('Cookie', adminCookie)
      .attach('file', big, { filename: 'a.mp3', contentType: 'audio/mpeg' });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });
});

describe('POST /api/admin/uploads/image', () => {
  it('admin uploads png → 200 with width + height', async () => {
    const res = await request(app)
      .post('/api/admin/uploads/image')
      .set('Cookie', adminCookie)
      .attach('file', Buffer.from('fake png'), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('res.cloudinary.com');
    expect(res.body.publicId).toContain('shlokas/images/');
    expect(res.body.width).toBe(800);
    expect(res.body.height).toBe(600);
  });

  it('wrong mime → 415', async () => {
    const res = await request(app)
      .post('/api/admin/uploads/image')
      .set('Cookie', adminCookie)
      .attach('file', Buffer.from('x'), { filename: 'x.gif', contentType: 'image/gif' });
    expect(res.status).toBe(415);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- uploads.integration
```

Expected: FAIL — routes don't exist.

- [ ] **Step 3: Write the routes**

Path: `src/routes/admin/uploads.ts`:

```ts
import { Router } from 'express';
import { audioUpload, imageUpload, handleUpload } from '../../middleware/upload.js';
import { uploadBuffer } from '../../lib/cloudinary.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';

export const adminUploadsRouter = Router();

adminUploadsRouter.use(requireAuth, requireRole('admin'));

adminUploadsRouter.post('/audio', handleUpload(audioUpload), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: { code: 'MISSING_FILE', message: 'No file' } });
      return;
    }
    const result = await uploadBuffer(req.file.buffer, 'shlokas/audio', 'video');
    res.json({
      url: result.url,
      publicId: result.publicId,
      duration: result.duration,
    });
  } catch (err) {
    next(err);
  }
});

adminUploadsRouter.post('/image', handleUpload(imageUpload), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: { code: 'MISSING_FILE', message: 'No file' } });
      return;
    }
    const result = await uploadBuffer(req.file.buffer, 'shlokas/images', 'image');
    res.json({
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Mount in server.ts**

Open `src/server.ts`. Add import near the other route imports:

```ts
import { adminUploadsRouter } from './routes/admin/uploads.js';
```

Add inside `buildApp`, after the existing `/api/auth` mount line:

```ts
  app.use('/api/admin/uploads', adminUploadsRouter);
```

- [ ] **Step 5: Run tests + verify**

```bash
npm test -- uploads.integration
npx tsc --noEmit
```

Expected: 8 tests pass, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/uploads.ts src/server.ts tests/uploads.integration.test.ts
git commit -m "feat: admin audio + image upload endpoints with multer + Cloudinary"
```

---

## Task 10: Admin Shloka Create + List + Get-by-Id

**Files:**
- Create: `src/routes/admin/shlokas.ts`
- Create: `tests/adminShlokas.integration.test.ts`
- Modify: `src/server.ts` (mount `/api/admin/shlokas`)

This task covers POST, GET list, and GET-by-id. PATCH lands in Task 11. DELETE lands in Task 12.

- [ ] **Step 1: Write the failing test**

Path: `tests/adminShlokas.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

vi.mock('cloudinary', async () => await import('../__mocks__/cloudinary.js'));

import { buildApp } from '../src/server.js';
import { User } from '../src/models/User.js';
import { Shloka } from '../src/models/Shloka.js';
import { hashPassword } from '../src/lib/password.js';
import { signSession } from '../src/lib/jwt.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof buildApp>;
let adminCookie: string;
let studentCookie: string;

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

beforeEach(async () => {
  await User.deleteMany({});
  await Shloka.deleteMany({});
  const admin = await User.create({
    email: 'admin@x.test',
    passwordHash: await hashPassword('password1'),
    role: 'admin',
    name: 'Admin',
  });
  const student = await User.create({
    email: 'student@x.test',
    passwordHash: await hashPassword('password1'),
    role: 'student',
    name: 'Student',
  });
  adminCookie = `sht_session=${signSession(admin._id.toString(), 'a'.repeat(32))}`;
  studentCookie = `sht_session=${signSession(student._id.toString(), 'a'.repeat(32))}`;
});

const VALID_BODY = {
  slug: 'taruna-jwara',
  title: 'Taruna Jwara',
  meaning: 'Treatment for the early stage of fever',
  translation: 'In the early stage of jwara, ...',
  audio: {
    full: { url: 'https://res.cloudinary.com/.../full.mp3', publicId: 'shlokas/audio/full' },
    lines: [
      { url: 'https://res.cloudinary.com/.../line-1.mp3', publicId: 'shlokas/audio/l1' },
    ],
  },
  lines: [
    {
      sanskrit: 'लङ्घनं स्वेदनं',
      transliteration: 'laṅghanaṁ svēdanaṁ',
      words: [
        { text: 'लङ्घनं', start: 0, end: 0.9 },
        { text: 'स्वेदनं', start: 0.9, end: 1.8 },
      ],
      fullTimings: [
        { text: 'लङ्घनं', start: 0, end: 0.9 },
        { text: 'स्वेदनं', start: 0.9, end: 1.8 },
      ],
    },
  ],
};

describe('POST /api/admin/shlokas', () => {
  it('admin creates a shloka → 200, status defaults to draft', async () => {
    const res = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('taruna-jwara');
    expect(res.body.status).toBe('draft');
    expect(res.body.audio.full.publicId).toBe('shlokas/audio/full'); // publicId visible in admin response
    expect(res.body.id).toBeDefined();
  });

  it('student → 403', async () => {
    const res = await request(app).post('/api/admin/shlokas').set('Cookie', studentCookie).send(VALID_BODY);
    expect(res.status).toBe(403);
  });

  it('duplicate slug → 409 SLUG_TAKEN', async () => {
    await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    const res = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_TAKEN');
  });

  it('invalid slug → 400', async () => {
    const res = await request(app)
      .post('/api/admin/shlokas')
      .set('Cookie', adminCookie)
      .send({ ...VALID_BODY, slug: 'Bad Slug!' });
    expect(res.status).toBe(400);
  });

  it('audio.lines.length mismatch with lines.length → 400 INVALID_TIMINGS', async () => {
    const body = {
      ...VALID_BODY,
      audio: { ...VALID_BODY.audio, lines: [] },
    };
    const res = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIMINGS');
  });

  it('words and fullTimings count mismatch → 400 INVALID_TIMINGS', async () => {
    const body = {
      ...VALID_BODY,
      lines: [{ ...VALID_BODY.lines[0], fullTimings: [{ text: 'x', start: 0, end: 1 }] }],
    };
    const res = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIMINGS');
  });

  it('overlapping word timings → 400 INVALID_TIMINGS', async () => {
    const body = {
      ...VALID_BODY,
      lines: [
        {
          ...VALID_BODY.lines[0],
          words: [
            { text: 'a', start: 0, end: 1 },
            { text: 'b', start: 0.5, end: 1.5 }, // overlap
          ],
          fullTimings: [
            { text: 'a', start: 0, end: 1 },
            { text: 'b', start: 0.5, end: 1.5 },
          ],
        },
      ],
    };
    const res = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIMINGS');
  });
});

describe('GET /api/admin/shlokas', () => {
  it('returns all (drafts + published) when status=all', async () => {
    await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    await request(app)
      .post('/api/admin/shlokas')
      .set('Cookie', adminCookie)
      .send({ ...VALID_BODY, slug: 'second', status: 'published' });

    const res = await request(app).get('/api/admin/shlokas?status=all').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it('status=draft filters to drafts only', async () => {
    await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY); // draft
    await request(app)
      .post('/api/admin/shlokas')
      .set('Cookie', adminCookie)
      .send({ ...VALID_BODY, slug: 'pub', status: 'published' });

    const res = await request(app).get('/api/admin/shlokas?status=draft').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe('taruna-jwara');
  });

  it('student → 403', async () => {
    const res = await request(app).get('/api/admin/shlokas').set('Cookie', studentCookie);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/shlokas/:id', () => {
  it('returns the shloka', async () => {
    const created = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    const res = await request(app).get(`/api/admin/shlokas/${created.body.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('taruna-jwara');
  });

  it('unknown id → 404', async () => {
    const res = await request(app).get('/api/admin/shlokas/507f1f77bcf86cd799439011').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- adminShlokas.integration
```

Expected: FAIL — routes do not exist.

- [ ] **Step 3: Write the routes (POST + GET list + GET by id only — PATCH and DELETE come in later tasks)**

Path: `src/routes/admin/shlokas.ts`:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Shloka } from '../../models/Shloka.js';
import { toPublicShloka } from '../../lib/publicShloka.js';
import { isValidSlug } from '../../lib/slug.js';
import { encodeCursor, decodeCursor } from '../../lib/cursor.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';

export const adminShlokasRouter = Router();

adminShlokasRouter.use(requireAuth, requireRole('admin'));

const wordTimingSchema = z.object({
  text: z.string().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
});

const assetSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
});

const lineSchema = z.object({
  sanskrit: z.string().min(1).max(1000),
  transliteration: z.string().max(1000).default(''),
  words: z.array(wordTimingSchema),
  fullTimings: z.array(wordTimingSchema),
});

const baseBodySchema = z.object({
  slug: z.string().refine(isValidSlug, { message: 'Invalid slug (use lowercase kebab-case)' }),
  title: z.string().min(1).max(200),
  meaning: z.string().min(1).max(5000),
  translation: z.string().min(1).max(5000),
  status: z.enum(['draft', 'published']).optional(),
  audio: z.object({
    full: assetSchema,
    lines: z.array(assetSchema),
  }),
  image: assetSchema.optional(),
  lines: z.array(lineSchema),
});

function validateTimings(body: z.infer<typeof baseBodySchema>): string | null {
  if (body.audio.lines.length !== body.lines.length) {
    return 'audio.lines.length must equal lines.length';
  }
  for (let i = 0; i < body.lines.length; i++) {
    const line = body.lines[i];
    if (line.words.length !== line.fullTimings.length) {
      return `lines[${i}].words and fullTimings must have the same length`;
    }
    for (let k = 0; k < line.words.length; k++) {
      if (line.words[k].text !== line.fullTimings[k].text) {
        return `lines[${i}].words[${k}].text must equal lines[${i}].fullTimings[${k}].text`;
      }
    }
    for (const arr of [line.words, line.fullTimings]) {
      for (let k = 0; k < arr.length; k++) {
        if (arr[k].start >= arr[k].end) return `lines[${i}] timing ${k}: start must be < end`;
        if (k > 0 && arr[k].start < arr[k - 1].end) return `lines[${i}] timing ${k}: overlaps previous`;
      }
    }
  }
  return null;
}

const listQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

adminShlokasRouter.get('/', async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = {};
    if (q.status !== 'all') filter.status = q.status;
    const cursor = decodeCursor(q.cursor);
    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: new Date(cursor.createdAt) } },
        { createdAt: new Date(cursor.createdAt), _id: { $lt: new Types.ObjectId(cursor.id) } },
      ];
    }
    const docs = await Shloka.find(filter).sort({ createdAt: -1, _id: -1 }).limit(q.limit + 1);
    const hasMore = docs.length > q.limit;
    const items = docs.slice(0, q.limit).map((d) => toPublicShloka(d, { includePublicIds: true }));
    const last = docs[q.limit - 1];
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: (last.createdAt as Date).toISOString(), id: last._id.toString() }) : undefined;
    res.json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
});

adminShlokasRouter.get('/:id', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }
    const doc = await Shloka.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }
    res.json(toPublicShloka(doc, { includePublicIds: true }));
  } catch (err) {
    next(err);
  }
});

adminShlokasRouter.post('/', async (req, res, next) => {
  try {
    const body = baseBodySchema.parse(req.body);
    const timingsError = validateTimings(body);
    if (timingsError) {
      res.status(400).json({ error: { code: 'INVALID_TIMINGS', message: timingsError } });
      return;
    }
    const existing = await Shloka.findOne({ slug: body.slug });
    if (existing) {
      res.status(409).json({ error: { code: 'SLUG_TAKEN', message: 'Slug already used' } });
      return;
    }
    const doc = await Shloka.create({
      slug: body.slug,
      title: body.title,
      meaning: body.meaning,
      translation: body.translation,
      status: body.status ?? 'draft',
      audio: body.audio,
      image: body.image,
      lines: body.lines,
      createdBy: req.user!.id,
    });
    res.json(toPublicShloka(doc, { includePublicIds: true }));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Mount in server.ts**

Add import in `src/server.ts`:

```ts
import { adminShlokasRouter } from './routes/admin/shlokas.js';
```

Add mount in `buildApp`, near other admin mounts:

```ts
  app.use('/api/admin/shlokas', adminShlokasRouter);
```

- [ ] **Step 5: Run, verify pass**

```bash
npm test -- adminShlokas.integration
```

Expected: 11 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/shlokas.ts src/server.ts tests/adminShlokas.integration.test.ts
git commit -m "feat: admin shloka POST + GET list + GET by id with validation"
```

---

## Task 11: Admin Shloka PATCH

**Files:**
- Modify: `src/routes/admin/shlokas.ts`
- Modify: `tests/adminShlokas.integration.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/adminShlokas.integration.test.ts` (before its final closing line):

```ts
describe('PATCH /api/admin/shlokas/:id', () => {
  it('updates title + status', async () => {
    const created = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    const res = await request(app)
      .patch(`/api/admin/shlokas/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ title: 'New Title', status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
    expect(res.body.status).toBe('published');
  });

  it('can change slug if not colliding', async () => {
    const created = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    const res = await request(app)
      .patch(`/api/admin/shlokas/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ slug: 'renamed' });
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('renamed');
  });

  it('slug colliding with another shloka → 409', async () => {
    const first = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    await request(app)
      .post('/api/admin/shlokas')
      .set('Cookie', adminCookie)
      .send({ ...VALID_BODY, slug: 'second' });
    const res = await request(app)
      .patch(`/api/admin/shlokas/${first.body.id}`)
      .set('Cookie', adminCookie)
      .send({ slug: 'second' });
    expect(res.status).toBe(409);
  });

  it('unknown id → 404', async () => {
    const res = await request(app)
      .patch('/api/admin/shlokas/507f1f77bcf86cd799439011')
      .set('Cookie', adminCookie)
      .send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('invalid timings in updated line → 400', async () => {
    const created = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    const res = await request(app)
      .patch(`/api/admin/shlokas/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({
        lines: [
          {
            sanskrit: 'x',
            transliteration: '',
            words: [
              { text: 'a', start: 1, end: 0 }, // start > end
            ],
            fullTimings: [{ text: 'a', start: 1, end: 0 }],
          },
        ],
        audio: { ...VALID_BODY.audio, lines: [VALID_BODY.audio.lines[0]] },
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIMINGS');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- adminShlokas.integration -t PATCH
```

Expected: FAIL — PATCH route does not exist.

- [ ] **Step 3: Add PATCH route**

Open `src/routes/admin/shlokas.ts`. After the POST handler, add:

```ts
const patchBodySchema = baseBodySchema.partial();

adminShlokasRouter.patch('/:id', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }
    const body = patchBodySchema.parse(req.body);
    const doc = await Shloka.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }

    // If audio or lines are being changed, validate timings against the merged result
    const merged = {
      slug: body.slug ?? doc.slug,
      title: body.title ?? doc.title,
      meaning: body.meaning ?? doc.meaning,
      translation: body.translation ?? doc.translation,
      status: body.status ?? (doc.status as 'draft' | 'published'),
      audio: body.audio ?? doc.audio,
      image: body.image ?? doc.image,
      lines: body.lines ?? doc.lines,
    } as z.infer<typeof baseBodySchema>;

    const timingsError = validateTimings(merged);
    if (timingsError) {
      res.status(400).json({ error: { code: 'INVALID_TIMINGS', message: timingsError } });
      return;
    }

    if (body.slug && body.slug !== doc.slug) {
      const collide = await Shloka.findOne({ slug: body.slug, _id: { $ne: doc._id } });
      if (collide) {
        res.status(409).json({ error: { code: 'SLUG_TAKEN', message: 'Slug already used' } });
        return;
      }
      doc.slug = body.slug;
    }
    if (body.title !== undefined) doc.title = body.title;
    if (body.meaning !== undefined) doc.meaning = body.meaning;
    if (body.translation !== undefined) doc.translation = body.translation;
    if (body.status !== undefined) doc.status = body.status;
    if (body.audio !== undefined) doc.audio = body.audio;
    if (body.image !== undefined) doc.image = body.image;
    if (body.lines !== undefined) doc.lines = body.lines;
    await doc.save();
    res.json(toPublicShloka(doc, { includePublicIds: true }));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run, verify pass**

```bash
npm test -- adminShlokas.integration
```

Expected: 16 tests pass total (11 prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/shlokas.ts tests/adminShlokas.integration.test.ts
git commit -m "feat: admin shloka PATCH with timing validation + slug uniqueness"
```

---

## Task 12: Admin Shloka DELETE with Cloudinary Cleanup

**Files:**
- Modify: `src/routes/admin/shlokas.ts`
- Modify: `tests/adminShlokas.integration.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/adminShlokas.integration.test.ts` (before its final closing line):

```ts
import { __mocks as cloudinaryMocks } from '../__mocks__/cloudinary.js';

describe('DELETE /api/admin/shlokas/:id', () => {
  it('deletes the shloka and calls Cloudinary destroy for each asset', async () => {
    cloudinaryMocks.destroyMock.mockClear();
    const body = {
      ...VALID_BODY,
      audio: {
        full: { url: 'u1', publicId: 'pf' },
        lines: [
          { url: 'u2', publicId: 'p1' },
          { url: 'u3', publicId: 'p2' },
        ],
      },
      image: { url: 'u4', publicId: 'pi' },
      lines: [
        VALID_BODY.lines[0],
        {
          sanskrit: 'x',
          transliteration: '',
          words: [{ text: 'x', start: 0, end: 1 }],
          fullTimings: [{ text: 'x', start: 0, end: 1 }],
        },
      ],
    };
    const created = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(body);
    const res = await request(app).delete(`/api/admin/shlokas/${created.body.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // destroy called for: full audio, 2 line audios, 1 image = 4 calls
    expect(cloudinaryMocks.destroyMock.mock.calls.length).toBe(4);
    const publicIds = cloudinaryMocks.destroyMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(publicIds).toContain('pf');
    expect(publicIds).toContain('p1');
    expect(publicIds).toContain('p2');
    expect(publicIds).toContain('pi');

    const after = await Shloka.findById(created.body.id);
    expect(after).toBeNull();
  });

  it('Cloudinary destroy failure still returns 200', async () => {
    cloudinaryMocks.destroyMock.mockClear();
    cloudinaryMocks.destroyMock.mockRejectedValueOnce(new Error('cloud failure'));
    const created = await request(app).post('/api/admin/shlokas').set('Cookie', adminCookie).send(VALID_BODY);
    const res = await request(app).delete(`/api/admin/shlokas/${created.body.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const after = await Shloka.findById(created.body.id);
    expect(after).toBeNull();
  });

  it('unknown id → 404', async () => {
    const res = await request(app).delete('/api/admin/shlokas/507f1f77bcf86cd799439011').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- adminShlokas.integration -t DELETE
```

Expected: FAIL — DELETE route does not exist.

- [ ] **Step 3: Add DELETE route**

Open `src/routes/admin/shlokas.ts`. Add import at top:

```ts
import { deleteAsset } from '../../lib/cloudinary.js';
```

After the PATCH handler, add:

```ts
adminShlokasRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }
    const doc = await Shloka.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }
    const publicIds: Array<{ publicId: string; resourceType: 'image' | 'video' }> = [
      { publicId: doc.audio.full.publicId, resourceType: 'video' },
      ...doc.audio.lines.map((l) => ({ publicId: l.publicId, resourceType: 'video' as const })),
    ];
    if (doc.image) publicIds.push({ publicId: doc.image.publicId, resourceType: 'image' });

    await doc.deleteOne();

    // Best-effort Cloudinary cleanup — failures logged, response stays 200
    await Promise.all(
      publicIds.map((a) =>
        deleteAsset(a.publicId, a.resourceType).catch((err) => {
          console.error(`[shloka.delete] Cloudinary destroy failed for ${a.publicId}:`, err);
        }),
      ),
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run, verify pass**

```bash
npm test -- adminShlokas.integration
```

Expected: 19 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/shlokas.ts tests/adminShlokas.integration.test.ts
git commit -m "feat: admin shloka DELETE with best-effort Cloudinary cleanup"
```

---

## Task 13: Public Shloka Reads

**Files:**
- Create: `src/routes/shlokas.ts`
- Create: `tests/shlokas.integration.test.ts`
- Modify: `src/server.ts` (mount `/api/shlokas`)

- [ ] **Step 1: Write the failing test**

Path: `tests/shlokas.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

vi.mock('cloudinary', async () => await import('../__mocks__/cloudinary.js'));

import { buildApp } from '../src/server.js';
import { User } from '../src/models/User.js';
import { Shloka } from '../src/models/Shloka.js';
import { hashPassword } from '../src/lib/password.js';
import { signSession } from '../src/lib/jwt.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof buildApp>;
let adminCookie: string;
let studentCookie: string;
let adminId: string;

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

async function seedShloka(slug: string, status: 'draft' | 'published') {
  return Shloka.create({
    slug,
    title: 'T',
    meaning: 'M',
    translation: 'Tr',
    status,
    audio: {
      full: { url: 'u', publicId: 'p' },
      lines: [{ url: 'u', publicId: 'p1' }],
    },
    lines: [
      {
        sanskrit: 'a',
        transliteration: 'a',
        words: [{ text: 'a', start: 0, end: 1 }],
        fullTimings: [{ text: 'a', start: 0, end: 1 }],
      },
    ],
    createdBy: new mongoose.Types.ObjectId(adminId),
  });
}

beforeEach(async () => {
  await User.deleteMany({});
  await Shloka.deleteMany({});
  const admin = await User.create({
    email: 'admin@x.test',
    passwordHash: await hashPassword('password1'),
    role: 'admin',
    name: 'Admin',
  });
  const student = await User.create({
    email: 'student@x.test',
    passwordHash: await hashPassword('password1'),
    role: 'student',
    name: 'Student',
  });
  adminId = admin._id.toString();
  adminCookie = `sht_session=${signSession(admin._id.toString(), 'a'.repeat(32))}`;
  studentCookie = `sht_session=${signSession(student._id.toString(), 'a'.repeat(32))}`;
});

describe('GET /api/shlokas', () => {
  it('unauth → 401', async () => {
    const res = await request(app).get('/api/shlokas');
    expect(res.status).toBe(401);
  });

  it('student → only published', async () => {
    await seedShloka('draft-one', 'draft');
    await seedShloka('pub-one', 'published');
    const res = await request(app).get('/api/shlokas').set('Cookie', studentCookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe('pub-one');
  });

  it('admin also only sees published on this endpoint', async () => {
    await seedShloka('draft-x', 'draft');
    await seedShloka('pub-x', 'published');
    const res = await request(app).get('/api/shlokas').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe('pub-x');
  });

  it('response items do not include publicId', async () => {
    await seedShloka('p', 'published');
    const res = await request(app).get('/api/shlokas').set('Cookie', studentCookie);
    expect(res.body.items[0].audio.full.publicId).toBeUndefined();
  });

  it('cursor pagination works', async () => {
    for (let i = 0; i < 5; i++) {
      // small sleep so createdAt differs
      await new Promise((r) => setTimeout(r, 10));
      await seedShloka(`p-${i}`, 'published');
    }
    const first = await request(app).get('/api/shlokas?limit=2').set('Cookie', studentCookie);
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBeDefined();

    const second = await request(app)
      .get(`/api/shlokas?limit=2&cursor=${first.body.nextCursor}`)
      .set('Cookie', studentCookie);
    expect(second.status).toBe(200);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.items[0].slug).not.toBe(first.body.items[0].slug);
  });
});

describe('GET /api/shlokas/:slug', () => {
  it('unauth → 401', async () => {
    const res = await request(app).get('/api/shlokas/anything');
    expect(res.status).toBe(401);
  });

  it('published slug → 200', async () => {
    await seedShloka('hello', 'published');
    const res = await request(app).get('/api/shlokas/hello').set('Cookie', studentCookie);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('hello');
  });

  it('draft slug returns 404 even for admin', async () => {
    await seedShloka('secret', 'draft');
    const res = await request(app).get('/api/shlokas/secret').set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });

  it('unknown slug → 404', async () => {
    const res = await request(app).get('/api/shlokas/nope').set('Cookie', studentCookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- shlokas.integration
```

Expected: FAIL.

- [ ] **Step 3: Write the route**

Path: `src/routes/shlokas.ts`:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Shloka } from '../models/Shloka.js';
import { toPublicShloka } from '../lib/publicShloka.js';
import { encodeCursor, decodeCursor } from '../lib/cursor.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const shlokasRouter = Router();

shlokasRouter.use(requireAuth);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

shlokasRouter.get('/', async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = { status: 'published' };
    const cursor = decodeCursor(q.cursor);
    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: new Date(cursor.createdAt) } },
        { createdAt: new Date(cursor.createdAt), _id: { $lt: new Types.ObjectId(cursor.id) } },
      ];
    }
    const docs = await Shloka.find(filter).sort({ createdAt: -1, _id: -1 }).limit(q.limit + 1);
    const hasMore = docs.length > q.limit;
    const items = docs.slice(0, q.limit).map((d) => toPublicShloka(d, { includePublicIds: false }));
    const last = docs[q.limit - 1];
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: (last.createdAt as Date).toISOString(), id: last._id.toString() }) : undefined;
    res.json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
});

shlokasRouter.get('/:slug', async (req, res, next) => {
  try {
    const doc = await Shloka.findOne({ slug: req.params.slug.toLowerCase(), status: 'published' });
    if (!doc) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shloka not found' } });
      return;
    }
    res.json(toPublicShloka(doc, { includePublicIds: false }));
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Mount in server.ts**

Add import:

```ts
import { shlokasRouter } from './routes/shlokas.js';
```

Inside `buildApp`, near `/api/auth`:

```ts
  app.use('/api/shlokas', shlokasRouter);
```

- [ ] **Step 5: Run, verify pass**

```bash
npm test -- shlokas.integration
```

Expected: 9 tests pass.

- [ ] **Step 6: Run all tests + lint + build**

```bash
npm test && npm run lint && npx tsc --noEmit && npm run build
```

Expected: all green. Should be well over 50 tests passing total.

- [ ] **Step 7: Commit**

```bash
git add src/routes/shlokas.ts src/server.ts tests/shlokas.integration.test.ts
git commit -m "feat: public shloka read endpoints (auth-gated, published only) with pagination"
```

---

## Task 14: Update Render Config + README

**Files:**
- Modify: `render.yaml`
- Modify: `README.md`

- [ ] **Step 1: Add Cloudinary env vars to `render.yaml`**

Open `render.yaml`. Find the `envVars:` list. Add three entries before the list ends:

```yaml
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
```

The final file should have these three new entries alongside MONGO_URI/JWT_SECRET/FRONTEND_ORIGIN/ADMIN_*.

- [ ] **Step 2: Update `README.md`**

Open `README.md`. Replace the existing "## API Surface (v1)" section and everything after it with:

```markdown
## Cloudinary Setup

Audio and image uploads go to Cloudinary.

1. Sign up at https://cloudinary.com (free tier: 25 GB storage + 25 GB monthly bandwidth).
2. From your Cloudinary dashboard, copy: **Cloud Name**, **API Key**, **API Secret**.
3. Add to `.env` locally:
   ```
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```
4. In Render, set the same three vars in the dashboard (they are declared `sync: false` in `render.yaml`).

## API Surface (v2)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/auth/signup | none | creates student |
| POST | /api/auth/login | none | sets sht_session cookie |
| POST | /api/auth/logout | required | clears cookie |
| GET  | /api/auth/me | required | returns current user |
| GET  | /api/health | none | uptime + mongo state |
| GET  | /api/shlokas | required | list published, cursor pagination |
| GET  | /api/shlokas/:slug | required | published only; 404 on drafts |
| GET  | /api/admin/shlokas | admin | list incl. drafts; ?status=draft\|published\|all |
| GET  | /api/admin/shlokas/:id | admin | by id |
| POST | /api/admin/shlokas | admin | create (defaults status=draft) |
| PATCH | /api/admin/shlokas/:id | admin | partial update |
| DELETE | /api/admin/shlokas/:id | admin | hard delete + Cloudinary cleanup |
| POST | /api/admin/uploads/audio | admin | multipart `file`, mp3/wav, ≤20MB |
| POST | /api/admin/uploads/image | admin | multipart `file`, jpg/png/webp, ≤5MB |
```

- [ ] **Step 3: Commit**

```bash
git add render.yaml README.md
git commit -m "docs: add Cloudinary env vars to render.yaml + document v2 API"
```

---

## Task 15: End-to-End Curl QA

Manual verification. No code changes unless a bug surfaces.

**Prereqs:**
- Cloudinary account created and `.env` populated with `CLOUDINARY_*`.
- Mongo URI in `.env` (Atlas from sub-project 1).
- Admin already seeded from sub-project 1.

- [ ] **Step 1: Start backend dev server**

From `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend/`:

```bash
npm run dev
```

Expected: `shloka-backend listening on :4000`.

- [ ] **Step 2: Log in as admin and capture cookie**

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -c /tmp/admin-cookie.txt | jq .
```

(Substitute your real admin email and password, or `source .env && ...`.)

Expected: `{ "user": { ... "role": "admin" ... } }` and `/tmp/admin-cookie.txt` populated.

- [ ] **Step 3: Upload a small audio file**

Use any small MP3 you have. Example:

```bash
curl -s -X POST http://localhost:4000/api/admin/uploads/audio \
  -H "Origin: http://localhost:3000" \
  -b /tmp/admin-cookie.txt \
  -F "file=@/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/kayachikitsasutrani/public/audio/Navajwara_Part_1.mp3" | jq .
```

Expected: JSON with `url`, `publicId`, `duration`. Note the URL — visit it in a browser to confirm the file plays.

- [ ] **Step 4: Create a shloka**

Use the URL + publicId you got back. POST a minimal valid body:

```bash
curl -s -X POST http://localhost:4000/api/admin/shlokas \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -b /tmp/admin-cookie.txt \
  -d '{
    "slug": "smoke-test",
    "title": "Smoke Test",
    "meaning": "Smoke test meaning",
    "translation": "Smoke test translation",
    "status": "published",
    "audio": {
      "full": {"url": "<URL_FROM_STEP_3>", "publicId": "<PUBLIC_ID_FROM_STEP_3>"},
      "lines": [{"url": "<URL_FROM_STEP_3>", "publicId": "<PUBLIC_ID_FROM_STEP_3>"}]
    },
    "lines": [
      {
        "sanskrit": "smoke",
        "transliteration": "smoke",
        "words": [{"text":"smoke","start":0,"end":1}],
        "fullTimings": [{"text":"smoke","start":0,"end":1}]
      }
    ]
  }' | jq .
```

Expected: 200 with the created shloka including `id`, `audio.full.publicId` (visible in admin response).

- [ ] **Step 5: List public shlokas**

```bash
curl -s http://localhost:4000/api/shlokas \
  -H "Origin: http://localhost:3000" \
  -b /tmp/admin-cookie.txt | jq .
```

Expected: includes smoke-test entry. `audio.full.publicId` should be undefined in the response.

- [ ] **Step 6: Fetch by slug**

```bash
curl -s http://localhost:4000/api/shlokas/smoke-test \
  -H "Origin: http://localhost:3000" \
  -b /tmp/admin-cookie.txt | jq .
```

Expected: 200 with the shloka.

- [ ] **Step 7: Unauthenticated fetch is rejected**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/shlokas
```

Expected: `401`.

- [ ] **Step 8: Mark as draft, confirm public hides it**

```bash
curl -s -X PATCH http://localhost:4000/api/admin/shlokas/<ID_FROM_STEP_4> \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -b /tmp/admin-cookie.txt \
  -d '{"status":"draft"}' | jq .

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/shlokas/smoke-test \
  -H "Origin: http://localhost:3000" \
  -b /tmp/admin-cookie.txt
```

Expected: PATCH 200, GET returns 404 (draft hidden).

- [ ] **Step 9: Delete and confirm cleanup**

```bash
curl -s -X DELETE http://localhost:4000/api/admin/shlokas/<ID_FROM_STEP_4> \
  -H "Origin: http://localhost:3000" \
  -b /tmp/admin-cookie.txt | jq .
```

Expected: `{ "ok": true }`. Visit the Cloudinary URL from Step 3 — should now 404 (asset destroyed).

- [ ] **Step 10: If anything failed, report and the controller dispatches a fix**

Report findings before declaring done.

---

## Verification Checklist

Backend at `/Users/rohithutagonna/Documents/Rohit/kayachikitsasutrani/shloka-backend/`:

- [ ] `npm test` — all tests pass (sub-project 1 tests + new env/slug/cursor/cloudinary/uploads.integration/adminShlokas.integration/shlokas.integration tests)
- [ ] `npm run lint` — clean
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — produces `dist/`
- [ ] `node dist/server.js` boots (with env set)
- [ ] Manual QA from Task 15 passes end-to-end
