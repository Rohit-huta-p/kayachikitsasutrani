"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Heart,
  BookText,
  BookOpen,
  Trophy,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  EyeOff,
  ArrowLeft,
  PartyPopper,
} from "lucide-react";
import Leaderboard from "./Leaderboard";
import PracticeCard from "./PracticeCard";
import WordOrderGame from "./WordOrderGame";
import { useShlokaPlayer } from "./hooks/useShlokaPlayer";
import { useCompletionTracker } from "./hooks/useCompletionTracker";
import { useAuth } from "@/lib/auth/AuthContext";
import TopBar from "@/components/student/TopBar";
import MiniPlayer from "@/components/student/MiniPlayer";
import {
  SPEED_OPTIONS,
  SWIPE_THRESHOLD_PX,
  COLORS,
  SANSKRIT_FONT_FAMILY,
} from "@/constants";

const ShlokaDesc = ({ shloka }) => {
  const player = useShlokaPlayer(shloka);
  const { state: authState } = useAuth();
  const currentUserId = authState.status === "authed" ? authState.user.id : undefined;
  const tracker = useCompletionTracker(shloka.slug, player.state);

  const [hideSanskrit, setHideSanskrit] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  // Build the gallery list — prefer new images array, fall back to legacy single image.
  const gallery = (() => {
    const arr = shloka.images && shloka.images.length > 0
      ? shloka.images.map((i) => i.url)
      : shloka.image?.url
        ? [shloka.image.url]
        : [];
    return arr.length > 0 ? arr : ["/images/shloka_img_2.jpg"];
  })();

  // Playback speed (cycles through SPEED_OPTIONS on tap).
  const [playbackRate, setPlaybackRate] = useState(1);
  const cycleSpeed = () => {
    const i = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
  };

  // Apply playbackRate to the audio element. The browser resets rate to 1 on
  // each src change, so we re-apply whenever the current line audio src or
  // the user-selected rate changes.
  useEffect(() => {
    const audio = player.audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate, player.audioRef, player.currentSrc]);

  // Derive current rep audio progress (0..1) + elapsed/total seconds
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const audio = player.audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setElapsed(audio.currentTime || 0);
      setTotal(audio.duration || 0);
      setProgress(audio.duration ? (audio.currentTime || 0) / audio.duration : 0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
    };
  }, [player.audioRef, player.currentSrc]);

  // Map player.state.status → MiniPlayer status prop
  const miniStatus =
    player.state.status === "PAUSED" ? "paused" :
    player.state.status === "IDLE" ? "idle" :
    player.state.status === "DONE" ? "done" : "playing";

  const handlePlayPause = () => {
    if (player.state.status === "IDLE" || player.state.status === "DONE") {
      player.play();
    } else if (player.state.status === "PAUSED") {
      player.resume();
    } else {
      player.pause();
    }
  };

  // fullText is the verbatim display string (line breaks + admin's spacing
  // preserved). Logical words come from per-line `lines[i].sanskrit` split by
  // whitespace — this is the highlight granularity. We then walk fullText
  // once, finding each logical word's char position, so we can highlight
  // exactly those chars even when the admin joined them in the display
  // (e.g. "कासंमादौ" with no space).
  // Normalize to NFC so combining-diacritic variants (admin paste vs DB
  // store) compare equal — otherwise indexOf() silently fails on visually
  // identical Devanagari strings.
  const fullTextStr = (shloka.fullText ?? "").normalize("NFC");
  const logicalWords = shloka.lines.flatMap((l) =>
    ((l?.sanskrit ?? "").normalize("NFC")).split(/\s+/).filter(Boolean),
  );
  // Pre-compute fullText whitespace-separated tokens (fallback positions for
  // older shlokas whose bucket sanskrit doesn't substring-match fullText).
  const fullTextTokens = (() => {
    const out = [];
    let i = 0;
    while (i < fullTextStr.length) {
      while (i < fullTextStr.length && /\s/.test(fullTextStr[i])) i++;
      if (i >= fullTextStr.length) break;
      const start = i;
      while (i < fullTextStr.length && !/\s/.test(fullTextStr[i])) i++;
      out.push({ start, end: i });
    }
    return out;
  })();

  const wordPositions = (() => {
    const out = [];
    // Primary: substring search with cursor +1 per word so consecutive
    // logical words can OVERLAP in fullText — Sandhi-style joining where
    // two words share characters (e.g. "स्नेहाद्यै" + "द्यैर्धूमैर्लेहैश्च"
    // both appearing in the rendered "स्नेहाद्यैर्धूमैर्लेहैश्च"). Each next
    // search starts one char past the prior word's start.
    //
    // Fallback: when the bucket sanskrit doesn't substring-match fullText
    // at all (older shlokas whose per-line sanskrit was hand-segmented
    // differently from the fullText), use the fullText whitespace token at
    // the same global word index. Imperfect but visible.
    let cursor = 0;
    for (let i = 0; i < logicalWords.length; i++) {
      const w = logicalWords[i];
      const start = fullTextStr.indexOf(w, cursor);
      if (start !== -1) {
        out.push({ start, end: start + w.length });
        cursor = start + 1;
      } else if (i < fullTextTokens.length) {
        out.push(fullTextTokens[i]);
      } else {
        out.push(null);
      }
    }
    return out;
  })();

  // Brown-highlight ranges: every occurrence of every admin-marked word.
  const brownRanges = (() => {
    const out = [];
    for (const w of shloka.highlightWords ?? []) {
      if (!w) continue;
      let from = 0;
      while (true) {
        const idx = fullTextStr.indexOf(w, from);
        if (idx === -1) break;
        out.push({ start: idx, end: idx + w.length });
        from = idx + 1;
      }
    }
    return out;
  })();

  // Build a sorted list of cut points to slice fullText into segments where
  // each segment has uniform styling (brown? yellow?).
  const renderFullText = () => {
    if (!fullTextStr) return null;
    const yellowRange = globalWordIndex >= 0 ? wordPositions[globalWordIndex] : null;
    const cuts = new Set([0, fullTextStr.length]);
    for (const r of brownRanges) { cuts.add(r.start); cuts.add(r.end); }
    if (yellowRange) { cuts.add(yellowRange.start); cuts.add(yellowRange.end); }
    const points = Array.from(cuts).sort((a, b) => a - b);
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
      const segStart = points[i];
      const segEnd = points[i + 1];
      const text = fullTextStr.slice(segStart, segEnd);
      if (text.length === 0) continue;
      const isBrown = brownRanges.some((r) => r.start <= segStart && segStart < r.end);
      const isYellow = !!yellowRange && yellowRange.start <= segStart && segStart < yellowRange.end;
      segments.push({ text, isBrown, isYellow });
    }
    return segments.map((s, i) => (
      <span
        key={i}
        className={
          s.isYellow
            ? "lyric-active"
            : s.isBrown
              ? "lyric-brown"
              : "lyric-idle"
        }
      >
        {s.text}
      </span>
    ));
  };
  // Legacy variable kept for the status-pill / fallback display checks
  const fullWords = logicalWords;

  // Map (currentLine, currentWordIndex) → a global word index into fullWords.
  // -1 means no word is currently being highlighted (idle/done).
  const globalWordIndex = (() => {
    if (player.state.status === "IDLE" || player.state.status === "DONE") return -1;
    // currentWordIndex < 0 means "no word active right now" — typically a
    // brief frame during line transitions or between word windows. Don't
    // highlight anything (otherwise g + (-1) wraps back to the prior word).
    if (player.currentWordIndex < 0) return -1;
    let g = 0;
    for (let i = 0; i < player.currentLine; i++) {
      const line = shloka.lines[i];
      const count = (line?.words?.length || 0) || (line?.fullTimings?.length || 0);
      g += count;
    }
    return g + player.currentWordIndex;
  })();

  const lineCount = shloka.lines.length;
  const currentLineDisplay = Math.max(0, Math.min(player.currentLine, Math.max(0, lineCount - 1))) + 1;

  // ── Paragraph-aware status (counts visual `\n`-separated lines in fullText) ─
  const paragraphRanges = (() => {
    const parts = fullTextStr.split(/\r?\n/);
    const ranges = [];
    let cursor = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const trimmed = p.trim().length > 0;
      ranges.push({ start: cursor, end: cursor + p.length, hasContent: trimmed });
      cursor += p.length + 1; // +1 for the \n separator
    }
    return ranges;
  })();
  const contentParagraphCount = paragraphRanges.filter((r) => r.hasContent).length;
  const paragraphFromCharPos = (charPos) => {
    const all = paragraphRanges.findIndex((r) => charPos >= r.start && charPos < r.end);
    if (all < 0) return -1;
    // Convert to "content-only" index (skip empty paragraphs).
    let idx = -1;
    for (let i = 0; i <= all; i++) if (paragraphRanges[i].hasContent) idx++;
    return idx;
  };
  // First word position of the currently-playing line bucket.
  const currentBucketFirstPos = (() => {
    if (player.currentLine < 0) return null;
    let g = 0;
    for (let i = 0; i < player.currentLine; i++) {
      g += shloka.lines[i]?.fullTimings?.length ?? shloka.lines[i]?.words?.length ?? 0;
    }
    return wordPositions[g] ?? null;
  })();
  const currentParagraphIdx =
    currentBucketFirstPos ? paragraphFromCharPos(currentBucketFirstPos.start) : -1;

  // Mode flags for UI
  const isPlayingFull =
    player.state.status === "PLAYING_FULL" ||
    (player.state.status === "PAUSED" && player.state.prev?.status === "PLAYING_FULL");
  const isPlayingLine =
    player.state.status === "PLAYING_LINE" ||
    (player.state.status === "PAUSED" && player.state.prev?.status === "PLAYING_LINE");
  const isIdle = player.state.status === "IDLE" || player.state.status === "DONE";

  // Pick the most accurate line count + index. Prefer paragraph-by-\n
  // mapping; fall back to bucket index if mapping fails (e.g. no fullText).
  const useParagraphLabel = contentParagraphCount > 0 && currentParagraphIdx >= 0;
  const displayedLineIdx = useParagraphLabel ? currentParagraphIdx + 1 : currentLineDisplay;
  const displayedLineTotal = useParagraphLabel ? contentParagraphCount : lineCount;

  const statusLabel = isPlayingFull
    ? `Full audio · Rep ${player.rep || 0} / ${player.REPETITIONS}`
    : isPlayingLine
      ? `Line ${displayedLineIdx} of ${displayedLineTotal} · Rep ${player.rep || 0} / ${player.REPETITIONS}`
      : isIdle && player.state.status === "DONE"
        ? "Finished"
        : "Tap play to start";

  return (
    <>
      {/* Mobile (<md) */}
      <div className="md:hidden">
        <TopBar
          title={shloka.title}
          showBack
          trailing={
            <button
              type="button"
              onClick={() => { /* TODO: favorite toggle (deferred) */ }}
              className="touch-target"
              aria-label="Favorite"
            >
              <Heart size={20} />
            </button>
          }
        />

        {/* Body padded to clear sticky mini-player (~86px) + safe area + tab bar (already padded by (student) layout) */}
        <div className="px-4 py-3 flex flex-col gap-3 max-w-md mx-auto pb-[110px]">
          {/* Hero — swipeable image carousel with left thumbnail strip */}
          <div className="flex gap-2 items-stretch">
            {gallery.length > 1 && (
              <div className="flex flex-col gap-1.5 overflow-y-auto shrink-0 w-14 h-44 pr-0.5">
                {gallery.map((url, i) => (
                  <button
                    key={url + i}
                    type="button"
                    onClick={() => setCarouselIdx(i)}
                    aria-label={`View image ${i + 1}`}
                    className={`relative h-12 w-14 rounded-md overflow-hidden shrink-0 border-2 transition ${
                      i === carouselIdx ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image src={url} alt="" fill className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            )}
            <div
              className="relative h-44 flex-1 rounded-2xl overflow-hidden bg-[#2A1F12]"
              onTouchStart={(e) => { e.currentTarget.dataset.touchX = String(e.touches[0].clientX); }}
              onTouchEnd={(e) => {
                const startX = parseFloat(e.currentTarget.dataset.touchX || "0");
                const endX = e.changedTouches[0].clientX;
                const dx = endX - startX;
                if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
                if (dx < 0 && carouselIdx < gallery.length - 1) setCarouselIdx(carouselIdx + 1);
                if (dx > 0 && carouselIdx > 0) setCarouselIdx(carouselIdx - 1);
              }}
            >
              <Image
                key={carouselIdx}
                src={gallery[carouselIdx]}
                alt=""
                fill
                className="object-cover"
                aria-hidden="true"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <h1 className="text-base font-bold leading-tight">{shloka.title}</h1>
              </div>
              {gallery.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/55 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {carouselIdx + 1} / {gallery.length}
                </div>
              )}
            </div>
          </div>

          {/* Sanskrit display — verbatim fullText with current-word highlight via char positions */}
          {!hideSanskrit && (
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 text-center">
              {fullTextStr ? (
                <p
                  className="text-base leading-relaxed text-black whitespace-pre-wrap"
                  style={{ fontFamily: SANSKRIT_FONT_FAMILY }}
                >
                  {renderFullText()}
                </p>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  No full shloka text yet. Admin can add it in the edit form.
                </p>
              )}
              {shloka.reference && (
                <p className="mt-2 text-[11px] text-gray-500 italic">— {shloka.reference}</p>
              )}
              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-3 py-1 rounded-full border ${
                    isPlayingFull
                      ? "bg-accent text-white border-accent font-semibold"
                      : "bg-[#F5EFE5] text-brown border-[#E5DDD0]"
                  }`}
                >
                  {isPlayingFull && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  {statusLabel}
                </span>
                {!isPlayingFull && (
                  <button
                    type="button"
                    onClick={() => player.playFull()}
                    className="text-[10px] px-3 py-1 rounded-full border border-brown text-brown hover:bg-brown hover:text-white transition"
                  >
                    ▶ Play full audio
                  </button>
                )}
              </div>
            </div>
          )}
          {hideSanskrit && (
            <div className="bg-white border border-dashed border-[#E5DDD0] rounded-2xl p-4 text-center text-sm text-gray-500 italic">
              Sanskrit hidden — practice from memory. Tap 🙈 again to show.
            </div>
          )}

          {/* Meaning card */}
          <div className="bg-white border border-[#E5DDD0] rounded-xl p-3">
            <MeaningSection
              src={shloka.meaningAudio?.url}
              timings={shloka.meaningTimings}
              meaningText={shloka.meaning}
              mobile
            />
          </div>

          {/* Case Scenario (always visible, hidden if empty) */}
          {shloka.caseStudy && (
            <div className="bg-white border border-[#E5DDD0] rounded-xl p-3">
              <div className="text-sm font-bold text-brown mb-1.5 flex items-center gap-1.5">
                <BookText size={14} />
                Case Scenario
              </div>
              <p className="text-xs text-black leading-relaxed whitespace-pre-wrap">{shloka.caseStudy}</p>
            </div>
          )}

          {/* Practice card — type (transliteration) + draw */}
          <PracticeCard targetText={shloka.fullText ?? ""} />

          {/* Word-order arrangement game (drag-and-drop) */}
          <WordOrderGame fullText={shloka.fullText ?? ""} />

          {/* Completion banner */}
          {tracker.submitted && (
            <div className="mt-1 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800 flex items-center gap-2">
              <PartyPopper size={16} className="shrink-0" />
              <span>
                {tracker.alreadyCompleted
                  ? "You completed this earlier"
                  : "You completed it! Check the leaderboard below."}
              </span>
            </div>
          )}

          {/* Leaderboard — always visible */}
          <div className="bg-white border border-[#E5DDD0] rounded-xl">
            <div className="px-3 py-2.5 text-sm font-bold text-brown flex items-center gap-1.5 border-b border-[#F0E7D8]">
              <Trophy size={14} />
              Leaderboard
            </div>
            <div className="px-1 pb-1">
              <Leaderboard
                slug={shloka.slug}
                currentUserId={currentUserId}
                refreshKey={tracker.completionVersion}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop (md+) */}
      <div className="hidden md:block p-10">
        <a href="/home" className="inline-flex items-center gap-1 text-sm text-accent font-semibold hover:underline mb-3">
          <ArrowLeft size={16} />
          Back to all shlokas
        </a>
        <div className="grid md:grid-cols-6 gap-4">
          {/* Right Side */}
          <div className="col-span-4 space-y-4">
            {/* Shloka Heading — swipeable image carousel with left thumbnail strip */}
            <div className="relative flex items-stretch w-full gap-2">
              {gallery.length > 1 && (
                <div className="flex flex-col gap-2 overflow-y-auto shrink-0 w-20 h-64 pr-0.5">
                  {gallery.map((url, i) => (
                    <button
                      key={url + i}
                      type="button"
                      onClick={() => setCarouselIdx(i)}
                      aria-label={`View image ${i + 1}`}
                      className={`relative h-16 w-20 rounded-md overflow-hidden shrink-0 border-2 transition ${
                        i === carouselIdx ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <Image src={url} alt="" fill className="object-cover" unoptimized />
                    </button>
                  ))}
                </div>
              )}
              <div
                className="relative h-64 flex-1 bg-[#2A1F12] rounded-lg overflow-hidden"
                onTouchStart={(e) => { e.currentTarget.dataset.touchX = String(e.touches[0].clientX); }}
                onTouchEnd={(e) => {
                  const startX = parseFloat(e.currentTarget.dataset.touchX || "0");
                  const endX = e.changedTouches[0].clientX;
                  const dx = endX - startX;
                  if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
                  if (dx < 0 && carouselIdx < gallery.length - 1) setCarouselIdx(carouselIdx + 1);
                  if (dx > 0 && carouselIdx > 0) setCarouselIdx(carouselIdx - 1);
                }}
              >
                <Image
                  key={carouselIdx}
                  src={gallery[carouselIdx]}
                  alt="Shloka"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCarouselIdx((i) => Math.max(0, i - 1))}
                      disabled={carouselIdx === 0}
                      className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/55 text-white rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-30"
                      aria-label="Previous image"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setCarouselIdx((i) => Math.min(gallery.length - 1, i + 1))}
                      disabled={carouselIdx === gallery.length - 1}
                      className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/55 text-white rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-30"
                      aria-label="Next image"
                    >
                      ›
                    </button>
                    <div className="absolute top-2 right-2 bg-black/55 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      {carouselIdx + 1} / {gallery.length}
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between absolute bottom-4 left-3 right-3 text-left text-white">
                  <h1 className="text-2xl">{shloka.title}</h1>
                  <Heart size={18} />
                </div>
              </div>
            </div>

            {/* Shloka body — verbatim fullText with current-word highlight via char positions */}
            <div className="bg-white p-4 text-center place-items-center space-y-3 w-full">
              {fullTextStr ? (
                <p
                  className="text-2xl leading-relaxed text-black whitespace-pre-wrap"
                  style={{ fontFamily: SANSKRIT_FONT_FAMILY }}
                >
                  {renderFullText()}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic">No full shloka text yet.</p>
              )}
              {shloka.reference && (
                <p className="text-sm text-gray-500 italic">— {shloka.reference}</p>
              )}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${
                    isPlayingFull
                      ? "bg-accent text-white border-accent font-semibold"
                      : "bg-[#F5EFE5] text-brown border-[#E5DDD0]"
                  }`}
                >
                  {isPlayingFull && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  {statusLabel}
                </span>
                {!isPlayingFull && (
                  <button
                    type="button"
                    onClick={() => player.playFull()}
                    className="text-xs px-3 py-1 rounded-full border border-brown text-brown hover:bg-brown hover:text-white transition"
                  >
                    ▶ Play full audio
                  </button>
                )}
              </div>

              <button
                onClick={handlePlayPause}
                className="cursor-pointer bg-indigo-100/50 text-black/40 hover:text-black hover:bg-green-100 px-5 py-1 rounded-2xl"
              >
                {player.state.status === "IDLE" || player.state.status === "DONE"
                  ? "Play"
                  : player.state.status === "PAUSED"
                    ? "Resume"
                    : "Pause"}
              </button>
            </div>

            {/* Skip / Play / Skip / Hide */}
            <div className="bg-white/50 hover:bg-white p-10 space-y-5">
              <div className="flex justify-center items-center gap-3">
                <button
                  type="button"
                  onClick={player.skipPrev}
                  aria-label="Skip previous line"
                  className="w-12 h-12 rounded-full bg-white border border-[#E5DDD0] text-brown flex items-center justify-center hover:bg-accent-soft transition"
                >
                  <SkipBack size={22} />
                </button>
                <button
                  type="button"
                  onClick={player.isPlaying ? player.pause : handlePlayPause}
                  aria-label={player.isPlaying ? "Pause" : "Play"}
                  className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition"
                >
                  {player.isPlaying ? <Pause size={26} /> : <Play size={26} />}
                </button>
                <button
                  type="button"
                  onClick={player.skipNext}
                  aria-label="Skip next line"
                  className="w-12 h-12 rounded-full bg-white border border-[#E5DDD0] text-brown flex items-center justify-center hover:bg-accent-soft transition"
                >
                  <SkipForward size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => setHideSanskrit((v) => !v)}
                  aria-label={hideSanskrit ? "Show Sanskrit" : "Hide Sanskrit"}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition ${
                    hideSanskrit
                      ? "bg-accent text-white border-accent"
                      : "bg-white text-brown border-[#E5DDD0] hover:bg-accent-soft"
                  }`}
                >
                  <EyeOff size={20} />
                </button>
              </div>
              {/* Playback speed selector */}
              <div className="flex justify-center items-center gap-1.5 pt-1">
                <span className="text-xs text-gray-500">Speed:</span>
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPlaybackRate(s)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition ${
                      playbackRate === s
                        ? "bg-accent text-white border-accent font-bold"
                        : "bg-white text-brown border-[#E5DDD0] hover:bg-accent-soft"
                    }`}
                  >
                    {Number.isInteger(s) ? `${s}x` : `${s}x`}
                  </button>
                ))}
              </div>
              <div className="bg-grey-50 h-1"></div>
            </div>
          </div>

          {/* Left Side */}
          <div className="col-span-2 space-y-5">
            <div className="bg-indigo-50 p-4 rounded-lg">
              <MeaningSection
                src={shloka.meaningAudio?.url}
                timings={shloka.meaningTimings}
                meaningText={shloka.meaning}
              />
            </div>
            {shloka.caseStudy && (
              <div className="bg-white p-4 rounded-lg">
                <h2 className="text-xl text-brown flex items-center gap-2"><BookText size={18} /> Case Scenario</h2>
                <p className="text-sm mt-1 whitespace-pre-wrap text-black">{shloka.caseStudy}</p>
              </div>
            )}
            {/* Practice card — type (transliteration) + draw */}
            <PracticeCard targetText={shloka.fullText ?? ""} />
            {/* Word-order arrangement game (drag-and-drop) */}
            <WordOrderGame fullText={shloka.fullText ?? ""} />
          </div>
        </div>

        {tracker.submitted && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
            {tracker.alreadyCompleted ? (
              <>You completed this earlier 🎉</>
            ) : (
              <>🎉 You completed it! Check the leaderboard below.</>
            )}
          </div>
        )}
        <div className="mt-4">
          <Leaderboard
            slug={shloka.slug}
            currentUserId={currentUserId}
            refreshKey={tracker.completionVersion}
          />
        </div>
      </div>

      {/* Shared: hidden audio element driven by hook */}
      <audio ref={player.audioRef} src={player.currentSrc ?? undefined} />

      {/* Sticky mini-player — mobile only */}
      <div className="md:hidden">
        <MiniPlayer
          currentLine={displayedLineIdx}
          totalLines={displayedLineTotal}
          rep={player.rep || 1}
          maxReps={player.REPETITIONS}
          status={miniStatus}
          progress={progress}
          elapsedSec={elapsed}
          totalSec={total}
          hidden={hideSanskrit}
          speed={playbackRate}
          lineBoundaries={(() => {
            if (!total || total <= 0) return [];
            return shloka.lines
              .map((l) => {
                const ft = l.fullTimings ?? [];
                return ft.length > 0 ? ft[ft.length - 1].end : 0;
              })
              .filter((t) => t > 0 && t < total)
              .map((t) => t / total);
          })()}
          onPlayPause={handlePlayPause}
          onSkipPrev={player.skipPrev}
          onSkipNext={player.skipNext}
          onToggleHide={() => setHideSanskrit((v) => !v)}
          onCycleSpeed={cycleSpeed}
        />
      </div>
    </>
  );
};

/**
 * Meaning section with play/pause + word-level highlight synced to audio.
 * Whisper-generated timings drive highlighting; falls back to plain text
 * when no timings exist.
 */
const MeaningSection = ({ src, timings, meaningText, mobile }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const lastIdxRef = useRef(-1);
  const timingsRef = useRef(timings);
  timingsRef.current = timings;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [src]);

  // RAF loop for smooth word tracking
  useEffect(() => {
    if (!playing || !audioRef.current || !timingsRef.current?.length) return;
    let rafId;
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      const t = a.currentTime;
      const ts = timingsRef.current;
      let idx = -1;
      if (ts) {
        for (let i = 0; i < ts.length; i++) {
          if (t >= ts[i].start && t < ts[i].end) { idx = i; break; }
        }
      }
      if (idx !== lastIdxRef.current) {
        lastIdxRef.current = idx;
        setActiveIdx(idx);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  const toggle = () => {
    if (!audioRef.current && src) {
      const a = new Audio(src);
      a.addEventListener("ended", () => {
        setPlaying(false);
        setActiveIdx(-1);
        lastIdxRef.current = -1;
      });
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };

  // Find each timing segment's position in the meaning text
  const segmentPositions = React.useMemo(() => {
    if (!timings?.length) return null;
    const positions = [];
    for (let i = 0; i < timings.length; i++) {
      const pos = meaningText.indexOf(timings[i].text);
      if (pos >= 0) {
        positions.push({ start: pos, end: pos + timings[i].text.length, idx: i });
      }
    }
    positions.sort((a, b) => a.start - b.start);
    return positions.length > 0 ? positions : null;
  }, [meaningText, timings]);

  const hasTimings = timings?.length > 0 && segmentPositions?.length > 0;

  const renderText = () => {
    if (!hasTimings) {
      return (
        <p className={`${mobile ? "text-xs text-black leading-relaxed" : "text-sm text-black"} whitespace-pre-wrap`}>
          {meaningText}
        </p>
      );
    }
    const parts = [];
    let lastEnd = 0;
    segmentPositions.forEach((sp, i) => {
      if (sp.start > lastEnd) {
        parts.push(<span key={`gap-${i}`}>{meaningText.slice(lastEnd, sp.start)}</span>);
      }
      const isActive = sp.idx === activeIdx;
      parts.push(
        <span
          key={`seg-${i}`}
          className={isActive
            ? "bg-[#F5E6D0] text-[#6B4226] font-semibold rounded-sm px-0.5 transition-colors duration-150"
            : "transition-colors duration-150"
          }
        >
          {meaningText.slice(sp.start, sp.end)}
        </span>
      );
      lastEnd = sp.end;
    });
    if (lastEnd < meaningText.length) {
      parts.push(<span key="tail">{meaningText.slice(lastEnd)}</span>);
    }
    return (
      <p className={`${mobile ? "text-xs text-black leading-relaxed" : "text-sm text-black"} whitespace-pre-wrap`}>
        {parts}
      </p>
    );
  };

  return (
    <>
      <div className={mobile
        ? "text-sm font-bold text-brown mb-1.5 flex items-center gap-1.5"
        : "text-xl text-brown mb-2 flex items-center gap-2"
      }>
        {mobile && <BookOpen size={14} />}
        Meaning
        {src && (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause meaning audio" : "Play meaning audio"}
            className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white hover:opacity-90 transition shrink-0"
          >
            {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
          </button>
        )}
      </div>
      {renderText()}
    </>
  );
};

export default ShlokaDesc;
