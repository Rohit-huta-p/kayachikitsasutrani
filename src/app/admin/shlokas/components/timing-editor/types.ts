export interface WordEntry {
  /** Local UUID, never persisted. */
  id: string;
  /** Sanskrit word text (single source of truth for both arrays on submit). */
  text: string;
  /** Seconds within the line MP3 (sub-second resolution). */
  lineStart: number;
  lineEnd: number;
  /** Seconds within the full shloka MP3; null until admin marks it. */
  fullStart: number | null;
  fullEnd: number | null;
}

export interface Region {
  id: string;
  start: number;
  end: number;
}

export function makeWordId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `word-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
