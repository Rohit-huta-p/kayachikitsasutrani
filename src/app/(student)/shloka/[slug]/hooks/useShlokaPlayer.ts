"use client";

import type { PublicShloka } from "@/lib/auth/types";
import { useSeekShlokaPlayer } from "./useSeekShlokaPlayer";
import type { ShlokaPlayerApi } from "./useSeekShlokaPlayer";

/**
 * Single-audio player. Reads `audio.full` + `lines[].fullTimings` and drives
 * playback by seeking into the full audio file. The legacy per-line-audio
 * branch was removed; existing shlokas with `audio.lines` populated will
 * still work as long as their `fullTimings` are present.
 */
export function useShlokaPlayer(shloka: PublicShloka): ShlokaPlayerApi {
  return useSeekShlokaPlayer(shloka);
}

export type { ShlokaPlayerApi };
