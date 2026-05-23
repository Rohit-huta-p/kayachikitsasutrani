// src/lib/loadShloka.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadShloka } from './loadShloka';

describe('loadShloka', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and returns the shloka JSON', async () => {
    const sample = {
      id: 'taruna-jwara',
      title: 't',
      meaning: 'm',
      translation: 'tr',
      audio: { full: '/a/full.mp3', lines: ['/a/l1.mp3'] },
      lines: [
        {
          sanskrit: 'a b',
          transliteration: 'a b',
          words: [
            { text: 'a', start: 0, end: 1 },
            { text: 'b', start: 1, end: 2 },
          ],
          fullTimings: [
            { text: 'a', start: 0, end: 1 },
            { text: 'b', start: 1, end: 2 },
          ],
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sample,
    }));

    const result = await loadShloka('taruna-jwara');
    expect(result.id).toBe('taruna-jwara');
    expect(result.lines).toHaveLength(1);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await expect(loadShloka('missing')).rejects.toThrow(/missing/);
  });

  it('throws on missing required fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x' }),
    }));

    await expect(loadShloka('x')).rejects.toThrow(/invalid shloka/i);
  });
});
