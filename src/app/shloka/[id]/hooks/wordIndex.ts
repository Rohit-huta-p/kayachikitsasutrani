import type { WordTiming } from '@/lib/shloka.types';

/**
 * Returns the index of the word active at time `t`, or -1 if none.
 * A word is active when t >= word.start and t < word.end.
 */
export function findWordIndex(t: number, timings: WordTiming[]): number {
  for (let i = 0; i < timings.length; i++) {
    if (t >= timings[i].start && t < timings[i].end) return i;
  }
  return -1;
}
