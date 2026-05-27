// src/app/shloka/[id]/ShlokaDisplay.jsx
"use client";

import React from "react";

/**
 * Renders the active Sanskrit line (or full shloka) with per-word highlight.
 * Layout matches the previous version; only inner content changes from
 * a plain <p>{line}</p> to a span-per-word with conditional bg.
 *
 * Props:
 *   shloka            — Shloka object (new shape from /public/data)
 *   activeLine        — index of line to emphasize
 *   currentWordIndex  — index of word within activeLine to highlight, or -1
 *   rep               — current repetition (0 when not playing)
 *   maxReps           — total repetitions configured
 *   playingFull       — when true, show all lines stacked (current line emphasized)
 */
const ShlokaDisplay = ({
  shloka,
  activeLine,
  currentWordIndex,
  rep,
  maxReps,
  playingFull,
}) => {
  const renderLine = (line, lineIndex) => {
    const words = line.sanskrit.split(/\s+/).filter(Boolean);
    const isActive = lineIndex === activeLine;
    return (
      <p
        key={lineIndex}
        className={
          isActive
            ? "text-2xl px-4 bg-primary-light-1 w-full"
            : "text-2xl px-4 w-full opacity-40"
        }
      >
        {words.map((w, wi) => (
          <span
            key={wi}
            className={
              isActive && wi === currentWordIndex
                ? "bg-yellow-200 rounded px-1 transition-colors duration-150"
                : ""
            }
          >
            {w}{wi < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    );
  };

  return (
    <div className="bg-white p-3 text-center place-items-center space-y-2 w-full">
      {playingFull ? (
        <div>
          {shloka.lines.map((line, i) => renderLine(line, i))}
        </div>
      ) : (
        shloka.lines.map((line, i) =>
          activeLine === i ? (
            <React.Fragment key={i}>{renderLine(line, i)}</React.Fragment>
          ) : null,
        )
      )}

      <p className="bg-grey-100 w-fit text-[10px] rounded-2xl px-2">
        Line {activeLine + 1} of {shloka.lines.length} · Repetition {rep || 0} / {maxReps}
      </p>
    </div>
  );
};

export default ShlokaDisplay;
