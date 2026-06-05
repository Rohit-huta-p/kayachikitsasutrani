"use client";

import React, { useEffect, useState } from "react";
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
import { useShlokaPlayer } from "./hooks/useShlokaPlayer";
import { useCompletionTracker } from "./hooks/useCompletionTracker";
import { useAuth } from "@/lib/auth/AuthContext";
import TopBar from "@/components/student/TopBar";
import MiniPlayer from "@/components/student/MiniPlayer";

const ShlokaDesc = ({ shloka }) => {
  const player = useShlokaPlayer(shloka);
  const { state: authState } = useAuth();
  const currentUserId = authState.status === "authed" ? authState.user.id : undefined;
  const tracker = useCompletionTracker(shloka.slug, player.state);

  const [hideSanskrit, setHideSanskrit] = useState(false);

  // Playback speed (cycles through SPEED_OPTIONS on tap).
  const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5];
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

  // Split fullText into paragraphs (admin-entered line breaks preserved)
  // and each paragraph into words. A flat global index drives the highlight.
  const fullParagraphs = (shloka.fullText ?? "")
    .split(/\r?\n/)
    .map((p) => p.split(/[ \t]+/).filter(Boolean));
  const fullWords = fullParagraphs.flat();

  // Map (currentLine, currentWordIndex) → a global word index into fullWords.
  // -1 means no word is currently being highlighted (idle/done).
  const globalWordIndex = (() => {
    if (player.state.status === "IDLE" || player.state.status === "DONE") return -1;
    let g = 0;
    for (let i = 0; i < player.currentLine; i++) {
      g += shloka.lines[i]?.words?.length ?? 0;
    }
    return g + player.currentWordIndex;
  })();

  const lineCount = shloka.lines.length;
  const currentLineDisplay = Math.max(0, Math.min(player.currentLine, Math.max(0, lineCount - 1))) + 1;

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
          {/* Hero */}
          <div className="relative h-32 rounded-2xl overflow-hidden">
            <Image
              src="/images/shloka_img_2.jpg"
              alt=""
              fill
              className="object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <h1 className="text-base font-bold leading-tight">{shloka.title}</h1>
              <p className="text-[10px] opacity-90 mt-1">
                Guiding the Early Healing of Fever through Detox and Lightness
              </p>
            </div>
          </div>

          {/* Sanskrit display — full shloka text with current-word highlight + line breaks preserved */}
          {!hideSanskrit && (
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-4 text-center">
              {fullWords.length > 0 ? (
                <div className="text-base leading-relaxed text-brown space-y-1" style={{ fontFamily: "Georgia, serif" }}>
                  {(() => {
                    let runningIdx = 0;
                    return fullParagraphs.map((para, pi) => {
                      if (para.length === 0) {
                        // Empty line (admin hit Enter twice) — render a blank spacer.
                        return <div key={pi} className="h-2" />;
                      }
                      const start = runningIdx;
                      runningIdx += para.length;
                      return (
                        <p key={pi}>
                          {para.map((w, wi) => {
                            const gi = start + wi;
                            return (
                              <span
                                key={wi}
                                className={gi === globalWordIndex ? "bg-yellow-200 rounded px-1 transition-colors duration-150" : ""}
                              >
                                {w}{wi < para.length - 1 ? " " : ""}
                              </span>
                            );
                          })}
                        </p>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  No full shloka text yet. Admin can add it in the edit form.
                </p>
              )}
              <p className="inline-block mt-3 bg-[#F5EFE5] border border-[#E5DDD0] text-[10px] text-brown px-3 py-0.5 rounded-full">
                Line {currentLineDisplay} of {lineCount} · Rep {player.rep || 0} / {player.REPETITIONS}
              </p>
            </div>
          )}
          {hideSanskrit && (
            <div className="bg-white border border-dashed border-[#E5DDD0] rounded-2xl p-4 text-center text-sm text-gray-500 italic">
              Sanskrit hidden — practice from memory. Tap 🙈 again to show.
            </div>
          )}

          {/* Meaning card */}
          <div className="bg-white border border-[#E5DDD0] rounded-xl p-3">
            <div className="text-sm font-bold text-brown mb-1.5 flex items-center gap-1.5">
              <BookOpen size={14} />
              Meaning
            </div>
            <p className="text-xs text-brown leading-relaxed whitespace-pre-wrap">{shloka.meaning}</p>
          </div>

          {/* Case Study (always visible, hidden if empty) */}
          {shloka.caseStudy && (
            <div className="bg-white border border-[#E5DDD0] rounded-xl p-3">
              <div className="text-sm font-bold text-brown mb-1.5 flex items-center gap-1.5">
                <BookText size={14} />
                Case Study
              </div>
              <p className="text-xs text-brown leading-relaxed whitespace-pre-wrap">{shloka.caseStudy}</p>
            </div>
          )}

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
            {/* Shloka Heading */}
            <div className="relative flex flex-col items-center w-full">
              <div className="h-64 w-full flex justify-center z-5">
                <div className="black-overlay rounded-lg"></div>
                <Image
                  src={"/images/shloka_img_2.jpg"}
                  alt="Shloka"
                  width={1400}
                  height={240}
                  className="rounded-lg w-full object-cover h-full"
                />
                <div className="flex items-center justify-between absolute bottom-4 left-3 text-left w-full text-white">
                  <div>
                    <h1 className="text-2xl">{shloka.title}</h1>
                    <p className="text-xs">
                      Guiding the Early Healing of Fever through Detox and Lightness
                    </p>
                  </div>
                  <Heart size={18} className="absolute right-6 bottom-1" />
                </div>
              </div>
            </div>

            {/* Shloka body — full text with word highlight, line breaks preserved */}
            <div className="bg-white p-4 text-center place-items-center space-y-3 w-full">
              {fullWords.length > 0 ? (
                <div className="text-2xl leading-relaxed text-brown space-y-1" style={{ fontFamily: "Georgia, serif" }}>
                  {(() => {
                    let runningIdx = 0;
                    return fullParagraphs.map((para, pi) => {
                      if (para.length === 0) {
                        return <div key={pi} className="h-3" />;
                      }
                      const start = runningIdx;
                      runningIdx += para.length;
                      return (
                        <p key={pi}>
                          {para.map((w, wi) => {
                            const gi = start + wi;
                            return (
                              <span
                                key={wi}
                                className={gi === globalWordIndex ? "bg-yellow-200 rounded px-1 transition-colors duration-150" : ""}
                              >
                                {w}{wi < para.length - 1 ? " " : ""}
                              </span>
                            );
                          })}
                        </p>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No full shloka text yet.</p>
              )}
              <p className="inline-block bg-[#F5EFE5] border border-[#E5DDD0] text-xs text-brown px-3 py-0.5 rounded-full">
                Line {currentLineDisplay} of {lineCount} · Rep {player.rep || 0} / {player.REPETITIONS}
              </p>

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
              <h2 className="text-xl text-brown mb-2">Meaning</h2>
              <p className="text-sm whitespace-pre-wrap">{shloka.meaning}</p>
            </div>
            {shloka.caseStudy && (
              <div className="bg-white p-4 rounded-lg">
                <h2 className="text-xl text-brown flex items-center gap-2"><BookText size={18} /> Case Study</h2>
                <p className="text-sm mt-1 whitespace-pre-wrap text-gray-700">{shloka.caseStudy}</p>
              </div>
            )}
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
          currentLine={Math.max(1, player.currentLine + 1)}
          totalLines={shloka.lines.length}
          rep={player.rep || 1}
          maxReps={player.REPETITIONS}
          status={miniStatus}
          progress={progress}
          elapsedSec={elapsed}
          totalSec={total}
          hidden={hideSanskrit}
          speed={playbackRate}
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

export default ShlokaDesc;
