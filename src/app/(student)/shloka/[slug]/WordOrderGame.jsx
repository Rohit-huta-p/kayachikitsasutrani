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
import { Sparkles, Shuffle, RotateCcw, Check } from "lucide-react";

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
 * One draggable pill.
 *
 * Visual states (mutually exclusive):
 *   solved  — the whole verse is in order; green gradient + ordinal numeral.
 *   correct — this pill is currently in its right slot (live hint) but the
 *             verse isn't complete yet. Soft green tint + check medallion.
 *             Stays fully draggable so the user can rearrange freely.
 *   rest    — neutral.
 */
function SortablePill({ id, text, solved, correct, index }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: solved });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const stateClass = solved
    ? "wog-pill--solved"
    : correct
      ? "wog-pill--correct"
      : "wog-pill--rest";

  const classes = ["wog-pill font-deva", stateClass, isDragging ? "wog-pill--ghost" : ""]
    .filter(Boolean)
    .join(" ");

  const label = correct
    ? `${text}. Currently in correct position ${index + 1}. Drag to move.`
    : solved
      ? `${text}. Position ${index + 1}, verse complete.`
      : `Word ${text}. Position ${index + 1}. Drag to reorder.`;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      aria-label={label}
      aria-pressed={correct || solved || undefined}
      className={classes}
    >
      {text}
      {correct && !solved && (
        <span aria-hidden className="wog-pill__badge wog-pill__badge--check">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
      {solved && <span aria-hidden className="wog-pill__index">{index + 1}</span>}
    </button>
  );
}

function DragPreviewPill({ text }) {
  return (
    <div className="wog-pill--overlay font-deva" aria-hidden>
      {text}
    </div>
  );
}

/**
 * Drag-and-drop word arranging game.
 *
 * Tokenises shloka.fullText, scrambles into a pool of pills, lets the
 * student drag pills into the correct order. Pills that happen to sit in
 * their target slot get a live "✓" hint (green tint + check medallion) but
 * remain fully draggable — the student is free to keep rearranging without
 * any sticky/locked positions. When the entire pill order matches the
 * verse, a Sanskrit-manuscript "Well Done" seal ceremony plays.
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
  const handleDragCancel = () => setActiveId(null);

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

  const reshuffle = () => {
    setItems(shuffleArray(initialItems));
    setActiveId(null);
    setSolved(false);
    setMoves(0);
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

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
                  correct={item.text === words[pos]}
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

      {/* Hint or full-solve ceremony */}
      {!solved ? (
        <div className="wog-hint mt-3">
          <span className="wog-hint__ornament">⋅⋅⋅</span>
          <span className="shrink-0">
            Drag a word, drop it where it belongs. A ✓ appears when it's home.
          </span>
          <span className="wog-hint__rule" />
        </div>
      ) : (
        <div className="wog-victory mt-3 text-center" role="status" aria-live="polite">
          <span aria-hidden className="wog-orn wog-orn--tl">❦</span>
          <span aria-hidden className="wog-orn wog-orn--tr">❦</span>
          <span aria-hidden className="wog-orn wog-orn--bl">❦</span>
          <span aria-hidden className="wog-orn wog-orn--br">❦</span>

          <span aria-hidden className="wog-petal wog-petal--1">✦</span>
          <span aria-hidden className="wog-petal wog-petal--2">✧</span>
          <span aria-hidden className="wog-petal wog-petal--3">❋</span>
          <span aria-hidden className="wog-petal wog-petal--4">✦</span>
          <span aria-hidden className="wog-petal wog-petal--5">✧</span>

          <div className="wog-seal">
            <span aria-hidden className="wog-seal__flank">❦</span>
            <span className="wog-seal__word">Well Done</span>
            <span aria-hidden className="wog-seal__flank">❦</span>
          </div>

          <div className="wog-victory__caption">— Verse Complete —</div>
          <div className="wog-victory__meta">
            {moves === 0
              ? "Flawless · first try"
              : `Assembled in ${moves} move${moves === 1 ? "" : "s"}`}
          </div>

          <button type="button" onClick={reshuffle} className="wog-victory__cta">
            <RotateCcw size={12} /> Recite again
          </button>
        </div>
      )}
    </div>
  );
};

export default WordOrderGame;
