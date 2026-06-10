"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Shuffle,
  RotateCcw,
  Lightbulb,
  Sparkles,
  PartyPopper,
  ArrowRight,
} from "lucide-react";

function tokenize(s) {
  return (s || "").normalize("NFC").trim().split(/\s+/).filter(Boolean);
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Word-order practice game.
 *
 * Splits the shloka into line-scoped puzzles. Each puzzle:
 *  - Shows a pool of jumbled words.
 *  - User taps a pool word → it fills the next empty ordered slot.
 *  - User taps a filled slot → that word returns to the pool.
 *  - Slots turn green when the word matches the target position.
 *  - When all slots are correct, a celebration banner appears.
 *  - On multi-line shlokas, a "Next line →" CTA jumps to the next puzzle.
 *
 * Tap-to-place beats drag-and-drop here: works identically on touch and
 * desktop with no DnD libraries and no scroll-conflict on mobile.
 */
const WordOrderGame = ({ lines, fullText }) => {
  // Build per-line word buckets. Prefer shloka.lines[].sanskrit; fall back to
  // splitting fullText on newlines.
  const lineBuckets = useMemo(() => {
    const fromLines = (lines || [])
      .map((l, i) => ({
        idx: i,
        label: `Line ${i + 1}`,
        words: tokenize(l?.sanskrit || ""),
      }))
      .filter((b) => b.words.length > 0);
    if (fromLines.length > 0) return fromLines;

    const parts = (fullText || "")
      .split(/\r?\n/)
      .map((p, i) => ({
        idx: i,
        label: `Line ${i + 1}`,
        words: tokenize(p),
      }))
      .filter((b) => b.words.length > 0);
    return parts;
  }, [lines, fullText]);

  const [scope, setScope] = useState(0);
  const target = lineBuckets[scope]?.words || [];

  const [pool, setPool] = useState([]);
  const [placed, setPlaced] = useState([]);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Reset puzzle on scope change.
  useEffect(() => {
    const items = target.map((t, i) => ({ id: `${scope}-${i}`, text: t }));
    setPool(shuffleArr(items));
    setPlaced(target.map(() => null));
    setHintsUsed(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, lineBuckets]);

  const allFilled = placed.length > 0 && placed.every((p) => p !== null);
  const correctness = placed.map((p, i) => p && p.text === target[i]);
  const allCorrect = allFilled && correctness.every(Boolean);
  const placedCount = placed.filter(Boolean).length;

  const tapPool = (id) => {
    const idx = pool.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const empty = placed.findIndex((s) => s === null);
    if (empty < 0) return;
    const next = [...placed];
    next[empty] = pool[idx];
    setPlaced(next);
    setPool(pool.filter((p) => p.id !== id));
  };

  const tapSlot = (slotIdx) => {
    const item = placed[slotIdx];
    if (!item) return;
    const next = [...placed];
    next[slotIdx] = null;
    setPlaced(next);
    setPool([...pool, item]);
  };

  const shufflePool = () => setPool(shuffleArr(pool));

  const reset = () => {
    const items = target.map((t, i) => ({ id: `${scope}-${i}`, text: t }));
    setPool(shuffleArr(items));
    setPlaced(target.map(() => null));
    setHintsUsed(0);
  };

  // Place the next correct word into the next mismatched slot.
  const showHint = () => {
    for (let i = 0; i < placed.length; i++) {
      if (placed[i] && placed[i].text === target[i]) continue;
      let nextPool = [...pool];
      const nextPlaced = [...placed];
      if (nextPlaced[i]) {
        nextPool.push(nextPlaced[i]);
        nextPlaced[i] = null;
      }
      const matchIdx = nextPool.findIndex((p) => p.text === target[i]);
      if (matchIdx < 0) return;
      nextPlaced[i] = nextPool[matchIdx];
      nextPool = nextPool.filter((_, j) => j !== matchIdx);
      setPlaced(nextPlaced);
      setPool(nextPool);
      setHintsUsed((h) => h + 1);
      return;
    }
  };

  if (lineBuckets.length === 0) return null;

  return (
    <div className="bg-white border border-[#E5DDD0] rounded-xl p-3 space-y-2 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-brown flex items-center gap-1.5">
          <Sparkles size={14} /> Word Order
        </div>
        <div className="text-[10px] text-gray-500">
          {allCorrect ? (
            <span className="text-green-700 font-semibold">All correct</span>
          ) : (
            <>
              {placedCount} / {target.length} placed
            </>
          )}
        </div>
      </div>

      {/* Line picker */}
      {lineBuckets.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-500">Line:</span>
          {lineBuckets.map((b, i) => (
            <button
              key={b.idx}
              type="button"
              onClick={() => setScope(i)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                scope === i
                  ? "bg-brown text-white border-brown"
                  : "bg-white text-brown border-[#E5DDD0]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {/* Slots */}
      <div className="bg-accent-soft border border-[#F0E7D8] rounded-lg p-2 min-h-[64px]">
        <div className="text-[10px] text-gray-500 mb-1">
          Arrange in order — tap a word below
        </div>
        <div className="flex flex-wrap gap-1.5">
          {placed.map((slot, i) => {
            const ok = slot && slot.text === target[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => tapSlot(i)}
                disabled={!slot}
                className={`min-w-[44px] min-h-[36px] px-2 py-1 rounded-lg border text-sm transition ${
                  slot
                    ? ok
                      ? "bg-green-50 border-green-300 text-green-800 shadow-sm"
                      : "bg-white border-[#E5DDD0] text-black"
                    : "bg-white/60 border-dashed border-[#D9CFBE] text-gray-300"
                }`}
                style={{ fontFamily: "Georgia, serif" }}
                aria-label={
                  slot ? `Slot ${i + 1}: ${slot.text} — tap to remove` : `Slot ${i + 1} empty`
                }
              >
                {slot ? slot.text : i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pool */}
      <div className="rounded-lg border border-[#E5DDD0] p-2 min-h-[52px]">
        <div className="text-[10px] text-gray-500 mb-1">Word pool</div>
        <div className="flex flex-wrap gap-1.5">
          {pool.length === 0 ? (
            <span className="text-xs text-gray-400 italic">
              Pool empty — every word is placed.
            </span>
          ) : (
            pool.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => tapPool(p.id)}
                className="px-2 py-1 rounded-lg border border-brown/40 bg-white text-sm text-black hover:bg-accent-soft hover:border-brown transition shadow-sm active:scale-95"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {p.text}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={shufflePool}
          disabled={pool.length < 2}
          className="text-xs text-brown px-2 py-1 rounded hover:bg-accent-soft transition flex items-center gap-1 disabled:opacity-40"
        >
          <Shuffle size={12} /> Shuffle
        </button>
        <button
          type="button"
          onClick={showHint}
          disabled={allCorrect}
          className="text-xs text-brown px-2 py-1 rounded hover:bg-accent-soft transition flex items-center gap-1 disabled:opacity-40"
        >
          <Lightbulb size={12} /> Hint
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-brown px-2 py-1 rounded hover:bg-accent-soft transition flex items-center gap-1"
        >
          <RotateCcw size={12} /> Reset
        </button>
        {hintsUsed > 0 && (
          <span className="text-[10px] text-gray-500 ml-auto">
            {hintsUsed} hint{hintsUsed > 1 ? "s" : ""} used
          </span>
        )}
      </div>

      {/* Celebration */}
      {allCorrect && (
        <div className="anim-fade-in mt-1 p-3 rounded-xl bg-gradient-to-r from-green-50 via-amber-50 to-amber-100 border border-green-200 flex items-center gap-2 relative overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute inset-0 anim-glow-sweep" />
          <PartyPopper size={20} className="text-amber-600 shrink-0 anim-pop" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-green-800 flex items-center gap-1.5">
              Shabaash!
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                {hintsUsed === 0 ? "Perfect" : `${target.length - hintsUsed}/${target.length} unaided`}
              </span>
            </div>
            <div className="text-[11px] text-gray-600">
              {hintsUsed === 0
                ? "First-try recall — that's mastery forming."
                : `Solved with ${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}. Try again with fewer.`}
            </div>
          </div>
          {scope + 1 < lineBuckets.length ? (
            <button
              type="button"
              onClick={() => setScope(scope + 1)}
              className="text-xs bg-accent text-white font-semibold rounded-full px-3 py-1.5 hover:opacity-90 transition flex items-center gap-1 shrink-0"
            >
              Next line <ArrowRight size={12} />
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="text-xs bg-accent text-white font-semibold rounded-full px-3 py-1.5 hover:opacity-90 transition flex items-center gap-1 shrink-0"
            >
              Play again <RotateCcw size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WordOrderGame;
