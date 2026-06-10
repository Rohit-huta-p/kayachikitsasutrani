"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Shuffle, PartyPopper, Sparkles, RotateCcw, GripVertical } from "lucide-react";

function tokenize(s) {
  return (s || "").normalize("NFC").trim().split(/\s+/).filter(Boolean);
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const isIdentity = a.every((v, i) => v.originalPos === i);
    if (!isIdentity || a.length <= 1) break;
  }
  return a;
}

/**
 * One draggable, sortable pill.
 *
 * dnd-kit gives us a transform on every reorder so reflow is smooth, plus
 * a transition for the items that get pushed out of the way. While a pill
 * is being dragged we hide its placeholder (opacity 0.35) and render an
 * elevated clone via <DragOverlay> at the parent level.
 */
function SortablePill({ id, text, solved }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    fontFamily: "Georgia, serif",
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      disabled={solved}
      aria-label={`Word ${text}. Drag to reorder.`}
      className={`select-none touch-none text-sm px-2.5 py-1 rounded-full border transition-colors duration-200 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-brown/50 ${
        solved
          ? "bg-green-50 border-green-300 text-green-800 anim-pop"
          : isDragging
            ? "opacity-35 bg-white border-[#E5DDD0] text-black"
            : "bg-white border-[#E5DDD0] text-black hover:border-brown hover:bg-accent-soft hover:shadow-sm"
      }`}
    >
      {text}
    </button>
  );
}

/**
 * Tall floating clone shown under the user's pointer while dragging.
 * Carries the same surface text but with a stronger shadow, slight scale,
 * and a tilt so the user can feel the pill is "picked up".
 */
function DragPreviewPill({ text }) {
  return (
    <button
      type="button"
      className="select-none text-sm px-2.5 py-1 rounded-full border border-brown bg-white text-black shadow-[0_10px_24px_rgba(124,95,60,0.30)] cursor-grabbing"
      style={{
        fontFamily: "Georgia, serif",
        transform: "scale(1.12) rotate(-2deg)",
      }}
    >
      {text}
    </button>
  );
}

/**
 * Draggable tap-to-swap word arranging game.
 *
 * Tokenises shloka.fullText by whitespace, scrambles the tokens into a
 * single flat pool of pills, and lets the student drag any pill onto
 * another pill's slot to reorder. Other pills animate out of the way as
 * the drag passes over them (dnd-kit sortable rect strategy). When the
 * surface order matches the original shloka, the card pulses green and a
 * celebration banner appears.
 *
 * Inputs are handled by three sensors: PointerSensor (mouse + pen),
 * TouchSensor (mobile), and KeyboardSensor (Space to grab, arrows to move
 * — keeps the puzzle usable without a pointer device).
 *
 * A short distance / delay activation constraint stops accidental drags
 * when the user is just tapping a pill to read it.
 */
const WordOrderGame = ({ fullText }) => {
  const words = useMemo(() => tokenize(fullText), [fullText]);

  // Each pill carries a stable id, its surface text, and the position it
  // originally occupied in the shloka. The id is suffixed with the index so
  // duplicate words remain distinct DnD entities.
  const initialItems = useMemo(
    () =>
      words.map((w, i) => ({
        id: `pill-${i}-${w}`,
        text: w,
        originalPos: i,
      })),
    [words],
  );

  const [items, setItems] = useState(() => shuffleArray(initialItems));
  const [solved, setSolved] = useState(false);
  const [moves, setMoves] = useState(0);
  const [activeId, setActiveId] = useState(null);

  // Reset when the shloka changes.
  useEffect(() => {
    setItems(shuffleArray(initialItems));
    setSolved(false);
    setMoves(0);
    setActiveId(null);
  }, [initialItems]);

  // Detect solved state — compare surface text so duplicate words are
  // interchangeable.
  useEffect(() => {
    if (items.length === 0) return;
    const correct = items.every((it, pos) => it.text === words[pos]);
    if (correct && !solved) setSolved(true);
    else if (!correct && solved) setSolved(false);
  }, [items, words, solved]);

  // 8px drag activation distance so a quick tap doesn't initiate a drag
  // and won't fight the user's intent. On touch we use a tiny delay
  // instead — pointer activation distance doesn't fire on most touch
  // browsers until a small grace period.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (words.length === 0) {
    return (
      <div className="bg-white border border-[#E5DDD0] rounded-xl p-3">
        <p className="text-xs text-gray-500 italic">No shloka text to arrange yet.</p>
      </div>
    );
  }

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
    setMoves((m) => m + 1);
  };

  const handleDragCancel = () => setActiveId(null);

  const reshuffle = () => {
    setItems(shuffleArray(initialItems));
    setSolved(false);
    setMoves(0);
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

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

      {/* Draggable pill pool */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-1.5 py-1">
            {items.map((item) => (
              <SortablePill
                key={item.id}
                id={item.id}
                text={item.text}
                solved={solved}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeItem ? <DragPreviewPill text={activeItem.text} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Hint / celebration */}
      {!solved ? (
        <p className="text-[10px] text-gray-500 italic flex items-center gap-1">
          <GripVertical size={10} className="text-gray-400" />
          Drag any word to a new spot. Other words slide out of the way.
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
