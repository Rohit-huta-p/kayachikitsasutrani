// src/lib/shloka.types.ts

export interface WordTiming {
  /** Sanskrit (Devanagari) word as it appears in the line text */
  text: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
}

export interface ShlokaLine {
  /** Full Sanskrit line (Devanagari) */
  sanskrit: string;
  /** Romanized transliteration */
  transliteration: string;
  /** Word timings relative to the line MP3 (audio.lines[i]) */
  words: WordTiming[];
  /** Word timings relative to the full MP3 (audio.full) */
  fullTimings: WordTiming[];
}

export interface Shloka {
  id: string;
  title: string;
  meaning: string;
  translation: string;
  audio: {
    /** Path to the full-shloka MP3, e.g. /audio/taruna-jwara/full.mp3 */
    full: string;
    /** Paths to per-line MP3s, indexed by line */
    lines: string[];
  };
  lines: ShlokaLine[];
}
