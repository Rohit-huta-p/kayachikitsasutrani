"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
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
import { PartyPopper, Sparkles, Shuffle, RotateCcw } from "lucide-react";

function tokenize(s) {
  return (s || "").normalize("NFC").trim().split(/\s+/).filter(Boolean);
}

function shuffleArray(arr) {
  const a = [...arr];
  // Fisher–Yates with a retry guard so we don't open the puzzle already
  // solved on small word counts.
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
 * One draggable pill.
 *
 * While dragging, the source becomes wog-pill--ghost (opacity 0) so the
 * <DragOverlay> clone is the only visible representation of the pill —
 * no double-image, no blurred half-ghost.
 */
function SortablePill({ id, text, solved, index }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: solved });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const classes = [
    "wog-pill font-deva",
    solved ? "wog-pill--solved" : "wog-pill--rest",
    isDragging ? "wog-pill--ghost" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      aria-label={`Word ${text}. Position ${index + 1}. Drag to reorder.`}
      className={classes}
    >
      {text}
      {solved && <span aria-hidden className="wog-pill__index">{index + 1}</span>}
    </button>
  );
}

/**
 * The floating clone shown under the user's pointer during a drag.
 * Identical surface text and metrics to the pill, plus depth shadow and a
 * subtle tilt to communicate "lifted off the page". transform-origin is
 * centred so the clone scales sharply without sub-pixel blur.
 */
function DragPreviewPill({ text }) {
  return (
    <div className="wog-pill--overlay font-deva" aria-hidden>
      {text}
    </div>
  );
}

/**
 * Draggable word-arrangement game with a refined editorial aesthetic.
 *
 * - Pills sit inside a parchment-coloured "frame" with a hand-drawn dashed
 *   border, soft inner shadow, paper grain texture, and corner-dot folio
 *   marks — visually distinct from the surrounding cards so the puzzle
 *   reads as a separate, intentional surface.
 * - Each pill has a min-width and consistent padding so even short words
 *   like "च" sit on the same visual baseline as long compounds.
 * - Devanagari renders in Tiro Devanagari Sanskrit (loaded via next/font),
 *   which preserves samyuktakshara ligatures and vedic marks; non-Devanagari
 *   characters fall back gracefully to system serifs.
 * - The DragOverlay clone is the only elevated copy of the pill at any
 *   time; the source pill goes to opacity 0 the moment a drag starts, so
 *   there is no faint duplicate behind the floating one.
 * - Three sensors keep the game usable everywhere: pointer (mouse / pen,
 *   6px activation distance), touch (120ms delay + 6px tolerance), and
 *   keyboard (Space to pick up, arrows to move, Space to drop).
 * - On solve, the card border greens, every pill gets a tiny ordinal
 *   numeral chip, and a manuscript-tinted celebration banner appears with
 *   the move count and a "Play again" CTA.
 */
const WordOrderGame = ({ fullText }) => {
  const words = useMemo(() => tokenize(fullText), [fullText]);

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
  const [activeId, setActiveId] = useState(null);
  const [solved, setSolved] = useState(false);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    setItems(shuffleArray(initialItems));
    setActiveId(null);
    setSolved(false);
    setMoves(0);
  }, [initialItems]);

  useEffect(() => {
    if (items.length === 0) return;
    const correct = items.every((it, pos) => it.text === words[pos]);
    if (correct && !solved) setSolved(true);
    else if (!correct && solved) setSolved(false);
  }, [items, words, solved]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (words.length === 0) {
    return (
      <div className="wog-card">
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

  // Drop animation: spring-overshoot easing so the released pill settles
  // with a small bounce, and the source pill stays invisible for the full
  // duration of the drop so we never expose the half-faded ghost mid-flight.
  const dropAnimation = {
    duration: 320,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0" } },
    }),
  };

  return (
    <div className={`wog-card ${solved ? "is-solved" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-sm font-bold text-brown flex items-center gap-1.5">
          <Sparkles size={14} /> Arrange the verse
        </div>
        <div className="flex items-center gap-2">
          <span className={`wog-chip ${solved ? "wog-chip--solved" : ""}`}>
            {solved
              ? moves === 0
                ? "Solved first try"
                : `${moves} move${moves === 1 ? "" : "s"} · solved`
              : `${moves} move${moves === 1 ? "" : "s"}`}
          </span>
          <button
            type="button"
            onClick={reshuffle}
            aria-label="Shuffle"
            className="text-[11px] text-brown px-2 py-1 rounded-full border border-[#E5DDD0] bg-white hover:bg-accent-soft transition flex items-center gap-1"
          >
            <Shuffle size={11} /> Shuffle
          </button>
        </div>
      </div>

      {/* Manuscript-framed pill pool */}
      <div className="wog-frame">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={rectSortingStrategy}
          >
            <div className="relative z-[1] flex flex-wrap gap-2">
              {items.map((item, pos) => (
                <SortablePill
                  key={item.id}
                  id={item.id}
                  text={item.text}
                  solved={solved}
                  index={pos}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={dropAnimation} zIndex={1000}>
            {activeItem ? <DragPreviewPill text={activeItem.text} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Hint or celebration */}
      {!solved ? (
        <div className="wog-hint mt-3">
          <span className="wog-hint__ornament">⋅⋅⋅</span>
          <span className="shrink-0">
            Drag a word, drop it where it belongs. Others slide aside.
          </span>
          <span className="wog-hint__rule" />
        </div>
      ) : (
        <div className="wog-celebrate mt-3 flex items-center gap-3">
          <PartyPopper size={22} className="text-amber-700 shrink-0 anim-pop relative z-10" />
          <div className="flex-1 min-w-0 relative z-10">
            <div className="text-sm font-bold text-green-900 flex items-center gap-2">
              Shabaash!
              <span className="text-[10px] bg-white/70 text-green-800 px-2 py-0.5 rounded-full border border-green-200/70">
                {moves === 0 ? "Flawless" : `${moves} move${moves === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="text-[11px] text-[#3A2C16]/70">
              The verse is in order. Each word found its place.
            </div>
          </div>
          <button
            type="button"
            onClick={reshuffle}
            className="relative z-10 text-xs bg-brown text-white font-semibold rounded-full px-3 py-1.5 hover:opacity-90 transition flex items-center gap-1 shrink-0"
            style={{ backgroundColor: "#A67C52" }}
          >
            Play again <RotateCcw size={12} />
          </button>
          <span aria-hidden className="confetti confetti-1">✦</span>
          <span aria-hidden className="confetti confetti-2">✧</span>
          <span aria-hidden className="confetti confetti-3">❋</span>
          <span aria-hidden className="confetti confetti-4">✺</span>
        </div>
      )}
    </div>
  );
};

export default WordOrderGame;
