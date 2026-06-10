"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Shuffle, PartyPopper, Sparkles, RotateCcw } from "lucide-react";

function tokenize(s) {
  return (s || "").normalize("NFC").trim().split(/\s+/).filter(Boolean);
}

function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  // Fisher–Yates with a retry loop so single-word puzzles and small word
  // lists don't open in already-solved order.
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const isIdentity = arr.every((v, i) => v === i);
    if (!isIdentity || arr.length <= 1) break;
  }
  return arr;
}

/**
 * Flat tap-to-swap word arranging game.
 *
 * Tokenises the full shloka by whitespace, scrambles the tokens into a
 * single pool of pills, and lets the student tap any pill then tap another
 * to swap their positions in place. When the surface order matches the
 * original shloka, the card pulses green and a celebration banner appears
 * with sparkle particles and a shimmer sweep.
 *
 * Duplicate words are treated as equivalent — if the same Devanagari token
 * appears twice, swapping in either copy at either correct slot counts as
 * solved.
 */
const WordOrderGame = ({ fullText }) => {
  const words = useMemo(() => tokenize(fullText), [fullText]);
  const [order, setOrder] = useState(() => shuffledIndices(words.length));
  const [selected, setSelected] = useState(null);
  const [solved, setSolved] = useState(false);
  const [moves, setMoves] = useState(0);

  // Reset when the target shloka changes.
  useEffect(() => {
    setOrder(shuffledIndices(words.length));
    setSelected(null);
    setSolved(false);
    setMoves(0);
  }, [fullText, words.length]);

  // Detect solved state. Compare surface text rather than original index so
  // duplicate words are interchangeable.
  useEffect(() => {
    if (words.length === 0) return;
    const correct = order.every((origIdx, pos) => words[origIdx] === words[pos]);
    if (correct && !solved) {
      setSolved(true);
      setSelected(null);
    } else if (!correct && solved) {
      setSolved(false);
    }
  }, [order, words, solved]);

  if (words.length === 0) {
    return (
      <div className="bg-white border border-[#E5DDD0] rounded-xl p-3">
        <p className="text-xs text-gray-500 italic">No shloka text to arrange yet.</p>
      </div>
    );
  }

  const handleTap = (pos) => {
    if (solved) return;
    if (selected === null) {
      setSelected(pos);
      return;
    }
    if (selected === pos) {
      setSelected(null);
      return;
    }
    setOrder((prev) => {
      const next = [...prev];
      [next[selected], next[pos]] = [next[pos], next[selected]];
      return next;
    });
    setMoves((m) => m + 1);
    setSelected(null);
  };

  const reshuffle = () => {
    setOrder(shuffledIndices(words.length));
    setSelected(null);
    setSolved(false);
    setMoves(0);
  };

  return (
    <div
      className={`relative bg-white border rounded-xl p-3 space-y-2 transition-colors duration-300 overflow-hidden ${
        solved
          ? "border-green-400 shadow-[0_0_0_3px_rgba(74,222,128,0.18)]"
          : "border-[#E5DDD0]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-brown flex items-center gap-1.5">
          <Sparkles size={14} /> Arrange the words
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {solved ? "Solved" : `${moves} move${moves === 1 ? "" : "s"}`}
          </span>
          <button
            type="button"
            onClick={reshuffle}
            className="text-[11px] text-brown px-2 py-1 rounded-full border border-[#E5DDD0] hover:bg-accent-soft transition flex items-center gap-1"
          >
            <Shuffle size={11} /> Shuffle
          </button>
        </div>
      </div>

      {/* Pills — flat list, all words, in current swap order */}
      <div className="flex flex-wrap gap-1.5">
        {order.map((origIdx, pos) => {
          const isSelected = selected === pos;
          const showCorrect = solved;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => handleTap(pos)}
              disabled={solved}
              className={`text-sm px-2.5 py-1 rounded-full border transition-all duration-200 ${
                showCorrect
                  ? "bg-green-50 border-green-300 text-green-800 anim-pop"
                  : isSelected
                    ? "bg-accent text-white border-accent scale-105 shadow-md"
                    : "bg-white border-[#E5DDD0] text-black hover:border-brown hover:bg-accent-soft active:scale-95"
              }`}
              style={{
                fontFamily: "Georgia, serif",
                animationDelay: showCorrect ? `${pos * 40}ms` : undefined,
              }}
            >
              {words[origIdx]}
            </button>
          );
        })}
      </div>

      {/* Hint / celebration */}
      {!solved ? (
        <p className="text-[10px] text-gray-500 italic">
          {selected === null
            ? "Tap a word, then tap another word to swap their positions."
            : "Now tap the word it should swap with. Tap again to cancel."}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-50 via-amber-50 to-amber-100 border border-green-200 p-3 flex items-center gap-2 mt-1">
          <span aria-hidden className="pointer-events-none absolute inset-0 anim-glow-sweep" />
          <PartyPopper size={20} className="text-amber-600 shrink-0 anim-pop" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-green-800 flex items-center gap-1.5">
              Shabaash!
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                {moves === 0 ? "First try" : `${moves} move${moves === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="text-[11px] text-gray-600">
              You arranged the shloka in the correct order.
            </div>
          </div>
          <button
            type="button"
            onClick={reshuffle}
            className="text-xs bg-accent text-white font-semibold rounded-full px-3 py-1.5 hover:opacity-90 transition flex items-center gap-1 shrink-0"
          >
            Play again <RotateCcw size={12} />
          </button>
          {/* Sparkle particles */}
          <span aria-hidden className="confetti confetti-1">✨</span>
          <span aria-hidden className="confetti confetti-2">⭐</span>
          <span aria-hidden className="confetti confetti-3">🌸</span>
          <span aria-hidden className="confetti confetti-4">🎉</span>
        </div>
      )}
    </div>
  );
};

export default WordOrderGame;
