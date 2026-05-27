import { describe, it, expect } from 'vitest';
import { findWordIndex } from './wordIndex';
import type { WordTiming } from '@/lib/auth/types';

const timings: WordTiming[] = [
  { text: 'a', start: 0.0, end: 1.0 },
  { text: 'b', start: 1.0, end: 2.0 },
  { text: 'c', start: 2.5, end: 3.0 }, // gap between b and c
];

describe('findWordIndex', () => {
  it('returns 0 at start', () => {
    expect(findWordIndex(0, timings)).toBe(0);
  });

  it('returns correct index mid-word', () => {
    expect(findWordIndex(0.5, timings)).toBe(0);
    expect(findWordIndex(1.5, timings)).toBe(1);
    expect(findWordIndex(2.7, timings)).toBe(2);
  });

  it('returns -1 in a gap between words', () => {
    expect(findWordIndex(2.2, timings)).toBe(-1);
  });

  it('returns -1 after the last word', () => {
    expect(findWordIndex(5.0, timings)).toBe(-1);
  });

  it('returns -1 before the first word', () => {
    expect(findWordIndex(-0.1, timings)).toBe(-1);
  });

  it('returns -1 for empty timings', () => {
    expect(findWordIndex(1, [])).toBe(-1);
  });

  it('treats end as exclusive', () => {
    // exactly at end of word 0 should land in gap or next word
    expect(findWordIndex(1.0, timings)).toBe(1); // start of next is inclusive
  });
});
