"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Heart, Check, Circle } from "lucide-react";
import { MdOutlineSkipPrevious, MdPlayArrow, MdSkipNext } from "react-icons/md";
import { CiPause1 } from "react-icons/ci";
import { BiHide } from "react-icons/bi";
import ShlokaDisplay from "./ShlokaDisplay";
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
  const [lbOpen, setLbOpen] = useState(false);

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

  const playingFull =
    player.state.status === "PLAYING_FULL" ||
    (player.state.status === "PAUSING_REP" && player.state.mode === "FULL") ||
    player.state.status === "PAUSING_FULL" ||
    (player.state.status === "PAUSED" &&
      (player.state.prev.status === "PLAYING_FULL" ||
        player.state.prev.status === "PAUSING_FULL" ||
        (player.state.prev.status === "PAUSING_REP" && player.state.prev.mode === "FULL")));

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

          {/* Sanskrit display */}
          {!hideSanskrit && (
            <div className="bg-white border border-[#E5DDD0] rounded-2xl p-3">
              <ShlokaDisplay
                shloka={shloka}
                activeLine={Math.max(0, player.currentLine)}
                currentWordIndex={player.currentWordIndex}
                rep={player.rep}
                maxReps={player.REPETITIONS}
                playingFull={playingFull}
              />
            </div>
          )}
          {hideSanskrit && (
            <div className="bg-white border border-dashed border-[#E5DDD0] rounded-2xl p-4 text-center text-sm text-gray-500 italic">
              Sanskrit hidden — practice from memory. Tap 🙈 again to show.
            </div>
          )}

          {/* Meaning + Translation (collapsible) */}
          <details className="bg-white border border-[#E5DDD0] rounded-xl" open>
            <summary className="px-3 py-2.5 text-sm font-bold text-brown cursor-pointer list-none flex items-center justify-between">
              <span>📖 Meaning &amp; Translation</span>
              <span className="text-gray-400 text-xs">▲</span>
            </summary>
            <div className="px-3 pb-3 text-xs text-brown leading-relaxed">
              <p className="italic mb-2">{shloka.translation}</p>
              <p>{shloka.meaning}</p>
            </div>
          </details>

          {/* Lines summary */}
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Lines</div>
          {shloka.lines.map((line, i) => {
            const isCurrent = i === player.currentLine && player.state.status !== "IDLE" && player.state.status !== "DONE";
            const isDone = i < player.currentLine;
            return (
              <div
                key={i}
                className={`rounded-xl p-2.5 border ${
                  isCurrent
                    ? "bg-accent-soft border-accent shadow-[0_0_0_2px_rgba(212,165,116,0.25)]"
                    : isDone
                    ? "bg-white border-[#E5DDD0] opacity-60"
                    : "bg-white border-[#E5DDD0]"
                }`}
              >
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span aria-hidden="true" className="inline-flex items-center">
                    {isDone ? (
                      <Check size={12} className="text-green-600" />
                    ) : isCurrent ? (
                      <Circle size={6} className="fill-accent stroke-accent inline-block" />
                    ) : (
                      <Circle size={10} className="text-gray-300" />
                    )}
                  </span>
                  <span className={isCurrent ? "text-accent font-bold" : ""}>
                    Line {i + 1}{isCurrent ? ` · playing` : isDone ? ` · done` : ""}
                  </span>
                  {isCurrent && (
                    <span className="ml-auto">{player.rep}/{player.REPETITIONS} reps</span>
                  )}
                </div>
                <div className="text-xs text-brown mt-1">{line.sanskrit}</div>
              </div>
            );
          })}

          {/* Completion banner */}
          {tracker.submitted && (
            <div className="mt-1 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
              {tracker.alreadyCompleted
                ? "You completed this earlier 🎉"
                : "🎉 You completed it! Check the leaderboard below."}
            </div>
          )}

          {/* Leaderboard accordion */}
          <details
            className="bg-white border border-[#E5DDD0] rounded-xl"
            open={lbOpen}
            onToggle={(e) => setLbOpen(e.currentTarget.open)}
          >
            <summary className="px-3 py-2.5 text-sm font-bold text-brown cursor-pointer list-none flex items-center justify-between">
              <span>🏆 Leaderboard</span>
              <span className="text-gray-400 text-xs">{lbOpen ? "▲" : "▼"}</span>
            </summary>
            <div className="px-1 pb-1">
              <Leaderboard
                slug={shloka.slug}
                currentUserId={currentUserId}
                refreshKey={tracker.completionVersion}
              />
            </div>
          </details>
        </div>
      </div>

      {/* Desktop (md+) */}
      <div className="hidden md:block p-10">
        <p>Back to all shlokas</p>
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

            {/* Shloka body */}
            <div className="bg-white p-3 text-center place-items-center space-y-2 w-full">
              <ShlokaDisplay
                shloka={shloka}
                activeLine={Math.max(0, player.currentLine)}
                currentWordIndex={player.currentWordIndex}
                rep={player.rep}
                maxReps={player.REPETITIONS}
                playingFull={playingFull}
              />

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

            {/* Skip / Play / Skip */}
            <div className="bg-white/50 hover:bg-white p-10 space-y-5">
              <div className="flex justify-center items-center space-x-4">
                <MdOutlineSkipPrevious
                  onClick={player.skipPrev}
                  size={28}
                  className="cursor-pointer bg-indigo-100/40 text-black/40 hover:text-black hover:bg-indigo-100 p-1 rounded-2xl"
                />
                {player.isPlaying ? (
                  <CiPause1
                    onClick={player.pause}
                    size={28}
                    className="cursor-pointer bg-green-100/50 text-black/40 hover:text-black hover:bg-green-100 p-1 rounded-2xl"
                  />
                ) : (
                  <MdPlayArrow
                    onClick={handlePlayPause}
                    size={28}
                    className="cursor-pointer bg-green-100/50 text-black/40 hover:text-black hover:bg-green-100 p-1 rounded-2xl"
                  />
                )}
                <MdSkipNext
                  onClick={player.skipNext}
                  size={28}
                  className="cursor-pointer bg-indigo-100/40 text-black/40 hover:text-black hover:bg-indigo-100 p-1 rounded-2xl"
                />
                <BiHide
                  size={28}
                  className="cursor-pointer bg-red-100/50 text-black/40 hover:text-black hover:bg-red-100 p-1 rounded-2xl"
                />
              </div>
              <div className="bg-grey-50 h-1"></div>
            </div>
          </div>

          {/* Left Side */}
          <div className="col-span-2 space-y-5">
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h2 className="text-xl text-brown">Meaning</h2>
              <p className="text-sm">{shloka.translation}</p>
              <p className="text-sm">{shloka.meaning}</p>
            </div>
            <div className="bg-white/60 p-4 rounded-lg">
              <h5 className="text-brown">Lines:</h5>
              {shloka.lines.map((line, i) => (
                <p
                  key={i}
                  className={i === 0 ? "" : "text-sm text-gray-400"}
                >
                  {line.sanskrit}
                </p>
              ))}
            </div>
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
          onPlayPause={handlePlayPause}
          onSkipPrev={player.skipPrev}
          onSkipNext={player.skipNext}
          onToggleHide={() => setHideSanskrit((v) => !v)}
        />
      </div>
    </>
  );
};

export default ShlokaDesc;
