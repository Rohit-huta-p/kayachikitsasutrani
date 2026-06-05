"use client";

import type { PublicShloka } from "@/lib/auth/types";
import { useLegacyShlokaPlayer, type ShlokaPlayerApi } from "./useLegacyShlokaPlayer";
import { useSeekShlokaPlayer } from "./useSeekShlokaPlayer";

/**
 * Picks the right player based on shloka shape:
 * - Legacy (per-line audio files): use `useLegacyShlokaPlayer` (src-swap playback)
 * - New (single full-audio only): use `useSeekShlokaPlayer` (seek-based playback)
 *
 * Both hooks are called (React rules), but only the active branch's audioRef is
 * returned and bound to the <audio> element. The inactive hook's effects see
 * `audioRef.current === null` and exit early.
 */
export function useShlokaPlayer(shloka: PublicShloka): ShlokaPlayerApi {
  const isLegacy = (shloka.audio.lines?.length ?? 0) > 0;
  const legacy = useLegacyShlokaPlayer(shloka);
  const seek = useSeekShlokaPlayer(shloka);
  return isLegacy ? legacy : seek;
}

export type { ShlokaPlayerApi };
