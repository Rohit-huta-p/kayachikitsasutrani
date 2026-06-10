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
import { Sparkles, Shuffle, RotateCcw, Check, X, CheckCircle2 } from "lucide-react";

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
 *   solved — the verse is fully assembled; render in green gradient with
 *            an ordinal numeral chip.
 *   wrong  — a Check has just been run and this pill is in the wrong slot;
 *            render in red gradient with a ✗ medallion. Reverts to neutral
 *            the moment the student drags any pill.
 *   rest   — neutral, draggable.
 */
function SortablePill({ id, text, solved, wrong, index }) {
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
    : wrong
      ? "wog-pill--wrong"
      : "wog-pill--rest";

  const classes = ["wog-pill font-deva", stateClass, isDragging ? "wog-pill--ghost" : ""]
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
      {wrong && !solved && (
        <span aria-hidden className="wog-pill__badge wog-pill__badge--cross">
          <X size={10} strokeWidth={3} />
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
 * Pills shuffle on mount, the student rearranges them by drag, and there
 * is NO live correctness feedback as they arrange. When the student is
 * ready they tap "Check": the pills that are out of order glow red with
 * a ✗ badge, and a banner reports the score. Any subsequent drag wipes
 * the red highlights so the next Check starts fresh.
 *
 * If a Check finds every pill in its correct slot, the Sanskrit-
 * manuscript "Well Done" ceremony fires.
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
  // checkResult is null until the student taps Check. After Check:
  //   { wrongIds: Set<string>, correct: number, total: number }
  // It is wiped on any drag so the highlighting only reflects the
  // outcome of the most recent Check, not stale state.
  const [checkResult, setCheckResult] = useState(null);

  useEffect(() => {
    setItems(shuffleArray(initialItems));
    setActiveId(null);
    setSolved(false);
    setMoves(0);
    setCheckResult(null);
  }, [initialItems]);

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

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    // First sign of motion wipes any previous Check highlight so the
    // student sees a clean board on the next attempt.
    if (checkResult) setCheckResult(null);
  };
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

  const handleCheck = () => {
    const wrongIds = new Set();
    let correct = 0;
    items.forEach((it, pos) => {
      if (it.text === words[pos]) correct++;
      else wrongIds.add(it.id);
    });
    if (correct === items.length) {
      // All in place — go straight to the victory ceremony, no red
      // highlights, no banner.
      setCheckResult(null);
      setSolved(true);
    } else {
      setCheckResult({ wrongIds, correct, total: items.length });
    }
  };

  const reshuffle = () => {
    setItems(shuffleArray(initialItems));
    setActiveId(null);
    setSolved(false);
    setMoves(0);
    setCheckResult(null);
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
          <Sparkles size={14} /> Arrange the Sutra
        </div>
        <div className="flex items-center gap-1.5">
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
          <button
            type="button"
            onClick={handleCheck}
            disabled={solved}
            aria-label="Check arrangement"
            className="text-[11px] font-semibold text-white bg-accent rounded-full px-2.5 py-1 hover:opacity-90 transition disabled:opacity-40 flex items-center gap-1"
          >
            <CheckCircle2 size={11} /> Check
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
                  wrong={!solved && !!checkResult?.wrongIds.has(item.id)}
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

      {/* Hint / check banner / ceremony */}
      {solved ? (
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
      ) : checkResult ? (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2"
          role="status"
          aria-live="polite"
        >
          <X size={14} className="text-red-700 shrink-0" />
          <div className="flex-1 min-w-0 text-[12px] text-red-800">
            <span className="font-semibold">{checkResult.correct} / {checkResult.total} correct</span>
            <span className="text-red-700/80">
              {" "}· {checkResult.total - checkResult.correct} word
              {checkResult.total - checkResult.correct === 1 ? "" : "s"} out of order
            </span>
          </div>
          <span className="text-[10px] text-red-700/70 italic shrink-0">
            Drag to fix · Check again
          </span>
        </div>
      ) : (
        <div className="wog-hint mt-3">
          <span className="wog-hint__ornament">⋅⋅⋅</span>
          <span className="shrink-0">
            Drag the words into the right order, then tap <span className="font-semibold">Check</span>.
          </span>
          <span className="wog-hint__rule" />
        </div>
      )}
    </div>
  );
};

export default WordOrderGame;
