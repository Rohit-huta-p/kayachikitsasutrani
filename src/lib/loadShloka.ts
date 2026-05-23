// src/lib/loadShloka.ts
import type { Shloka } from './shloka.types';

export async function loadShloka(id: string): Promise<Shloka> {
  const res = await fetch(`/data/${id}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load shloka "${id}" (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (
    !data ||
    typeof data.id !== 'string' ||
    !Array.isArray(data.lines) ||
    !data.audio ||
    typeof data.audio.full !== 'string'
  ) {
    throw new Error('Invalid shloka payload');
  }
  return data as Shloka;
}
