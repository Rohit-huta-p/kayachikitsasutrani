import type {
  PublicUser,
  SignupBody,
  RequestSignupBody,
  LoginBody,
  ApiError,
  PublicShloka,
  ShlokaInput,
  CompleteResponse,
  LeaderboardResponse,
  MyCompletionsResponse,
  AccessRequest,
  AcceptedAccessRequest,
} from './auth/types';

// Empty base — relative `/api/*` paths are proxied to the backend by
// Next.js rewrites in next.config.ts. This keeps cookies first-party
// (browser sees only the frontend origin) which fixes Safari ITP blocking.
const BASE = '';

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (res.status === 429 && attempt < maxAttempts - 1) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
      // Honor Retry-After if present (seconds), else exponential backoff (500ms, 1500ms)
      const delayMs = retryAfter > 0 ? retryAfter * 1000 : (500 * Math.pow(3, attempt));
      await new Promise((r) => setTimeout(r, Math.min(delayMs, 5000)));
      continue;
    }
    const body = (await res.json().catch(() => null)) as
      | ({ error?: { code: string; message: string } } & Record<string, unknown>)
      | null;
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
  // Unreachable in practice — the loop either returns or throws inside
  throw new Error('Request failed after retries');
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const body = (await res.json().catch(() => null)) as
    | ({ error?: { code: string; message: string } } & Record<string, unknown>)
    | null;
  if (!res.ok) {
    const code = body?.error?.code ?? `HTTP_${res.status}`;
    const message = body?.error?.message ?? `Upload failed (${res.status})`;
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
  requestSignup: (body: RequestSignupBody) =>
    request<{ ok: true; message: string }>('/api/auth/request-signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: LoginBody) =>
    request<{ user: PublicUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: Object.assign(
    () => request<{ user: PublicUser }>('/api/auth/me'),
    {
      completions: () => request<MyCompletionsResponse>(`/api/me/completions`),
    },
  ),

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

  admin: {
    shlokas: {
      list: (params?: { status?: 'draft' | 'published' | 'all'; limit?: number; cursor?: string }) =>
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
      audio: (file: File) =>
        uploadFile<{ url: string; publicId: string; duration?: number }>(`/api/admin/uploads/audio`, file),
      image: (file: File) =>
        uploadFile<{ url: string; publicId: string; width: number; height: number }>(`/api/admin/uploads/image`, file),
    },
    students: {
      list: (params?: { limit?: number; cursor?: string }) =>
        request<{ items: PublicUser[]; nextCursor?: string }>(`/api/admin/students${qs(params)}`),
      get: (id: string) =>
        request<{ user: PublicUser }>(`/api/admin/students/${id}`),
    },
    accessRequests: {
      list: () =>
        request<{ items: AccessRequest[] }>(`/api/admin/access-requests`),
      accept: (id: string) =>
        request<AcceptedAccessRequest>(`/api/admin/access-requests/${id}/accept`, {
          method: 'POST',
        }),
      reject: (id: string) =>
        request<{ ok: true }>(`/api/admin/access-requests/${id}/reject`, {
          method: 'POST',
        }),
    },
  },
};
