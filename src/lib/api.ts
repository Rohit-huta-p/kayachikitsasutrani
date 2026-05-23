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
