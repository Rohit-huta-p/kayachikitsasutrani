// src/app/shloka/[id]/ShlokaDesc.jsx
"use client";

import { Heart } from "lucide-react";
import Image from "next/image";
import React from "react";
import ShlokaDisplay from "./ShlokaDisplay";
import { MdOutlineSkipPrevious, MdPlayArrow, MdSkipNext } from "react-icons/md";
import { CiPause1 } from "react-icons/ci";
import { BiHide } from "react-icons/bi";
import { useShlokaPlayer } from "./hooks/useShlokaPlayer";
import Leaderboard from "./Leaderboard";
import { useCompletionTracker } from "./hooks/useCompletionTracker";
import { useAuth } from "@/lib/auth/AuthContext";

const ShlokaDesc = ({ shloka }) => {
  const player = useShlokaPlayer(shloka);
  const { state: authState } = useAuth();
  const currentUserId = authState.status === "authed" ? authState.user.id : undefined;
  const tracker = useCompletionTracker(shloka.slug, player.state);

  const playingFull =
    player.state.status === "PLAYING_FULL" ||
    (player.state.status === "PAUSING_REP" && player.state.mode === "FULL") ||
    player.state.status === "PAUSING_FULL" ||
    (player.state.status === "PAUSED" &&
      (player.state.prev.status === "PLAYING_FULL" ||
        player.state.prev.status === "PAUSING_FULL" ||
        (player.state.prev.status === "PAUSING_REP" && player.state.prev.mode === "FULL")));

  const handlePlayPause = () => {
    if (player.state.status === "IDLE" || player.state.status === "DONE") {
      player.play();
    } else if (player.state.status === "PAUSED") {
      player.resume();
    } else {
      player.pause();
    }
  };

  return (
    <div className="p-10">
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

            {/* Single audio element driven by hook */}
            <audio ref={player.audioRef} src={player.currentSrc ?? undefined} />
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
  );
};

export default ShlokaDesc;
