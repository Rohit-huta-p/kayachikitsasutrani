"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Sparkles, Shuffle, RotateCcw, Lock, Check } from "lucide-react";

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
 * One pill. Three visual states (mutually exclusive):
 *   solved  — entire verse complete; render in green gradient with ordinal.
 *   locked  — pill is in its correct slot and pinned there; gold ring + lock badge.
 *   rest    — neutral, draggable.
 *
 * dnd-kit's `useSortable` is told to disable drags when the pill is solved
 * or locked, so the pointer/touch/keyboard sensors all refuse to pick it
 * up. The drag-end logic in the parent also rejects any move that would
 * displace a locked pill from its slot.
 */
function SortablePill({ id, text, solved, locked, index }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: solved || locked });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const stateClass = solved
    ? "wog-pill--solved"
    : locked
      ? "wog-pill--locked"
      : "wog-pill--rest";

  const classes = ["wog-pill font-deva", stateClass, isDragging ? "wog-pill--ghost" : ""]
    .filter(Boolean)
    .join(" ");

  const label = locked
    ? `${text}. Locked in position ${index + 1}.`
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
      aria-pressed={locked || solved || undefined}
      className={classes}
    >
      {text}
      {locked && !solved && (
        <span aria-hidden className="wog-pill__badge wog-pill__badge--lock">
          <Lock size={9} strokeWidth={2.6} />
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
 * Word-order game with **slot-locking** semantics.
 *
 * When a pill is dropped into its correct slot it immediately locks:
 *   1. Its `id` is added to a `locked` Set so it can never be dragged again.
 *   2. Its position becomes an immovable barrier — any subsequent drag
 *      reorders only the *unlocked* pills around it; locked pills stay
 *      pinned to their slot exactly where the user placed them.
 *   3. A small confirmation toast slides in from the top of the card for
 *      ~1.6s ("Placed correctly · locked").
 *
 * The shuffler can leave some pills already in their correct slot at game
 * start — those auto-lock on mount so we never strand a "correct but not
 * locked" pill that the user could accidentally move.
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

  // `items` is the current display order. `locked` is the Set of ids that
  // are pinned to their current position because they match the target word
  // at that position.
  const [items, setItems] = useState(() => shuffleArray(initialItems));
  const [locked, setLocked] = useState(() => new Set());
  const [activeId, setActiveId] = useState(null);
  const [solved, setSolved] = useState(false);
  const [moves, setMoves] = useState(0);

  // Toast state: a short transient message after a lock event. We key by an
  // incrementing counter so the same message can re-trigger and we get a
  // fresh animation each time.
  const [toast, setToast] = useState(null); // { key, text }
  const toastTimerRef = useRef(null);

  // Reset on shloka change. Re-derive auto-locks from the freshly shuffled
  // board so any pill that happens to land in its correct slot starts
  // locked.
  useEffect(() => {
    const fresh = shuffleArray(initialItems);
    const autoLocked = new Set();
    fresh.forEach((it, pos) => {
      if (it.text === words[pos]) autoLocked.add(it.id);
    });
    setItems(fresh);
    setLocked(autoLocked);
    setActiveId(null);
    setSolved(false);
    setMoves(0);
    setToast(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, [initialItems, words]);

  // Whole-verse solved detection.
  useEffect(() => {
    if (items.length === 0) return;
    const correct = items.every((it, pos) => it.text === words[pos]);
    if (correct && !solved) setSolved(true);
    else if (!correct && solved) setSolved(false);
  }, [items, words, solved]);

  // Clear toast timer on unmount.
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = (text) => {
    setToast({ key: Date.now(), text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  };

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

  // Custom move logic — reorder only the unlocked pills, keep locked ones
  // pinned to their slots. Then check whether the move newly placed any
  // pills into their correct positions and lock those too.
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const srcIdx = items.findIndex((p) => p.id === active.id);
    const dstIdx = items.findIndex((p) => p.id === over.id);
    if (srcIdx < 0 || dstIdx < 0) return;
    if (locked.has(active.id)) return; // shouldn't happen — sensor disabled — but defend anyway

    // Build the unlocked-only sublist and project the source/target indices
    // into it.
    const unlocked = items.filter((p) => !locked.has(p.id));
    const srcInUnlocked = unlocked.findIndex((p) => p.id === active.id);

    // Count how many unlocked items sit before dstIdx in the full board.
    let unlockedBeforeDst = 0;
    for (let k = 0; k < dstIdx; k++) {
      if (!locked.has(items[k].id)) unlockedBeforeDst++;
    }
    // If the drop target itself is unlocked, that slot is the dst index in
    // the unlocked subarray. If the drop target is locked, the drag should
    // resolve to the nearest *unlocked* slot in the drag direction; using
    // unlockedBeforeDst gives the slot "just before" the locked pill, which
    // is the natural place a forward drag would settle.
    const dstInUnlocked = locked.has(over.id)
      ? Math.max(0, unlockedBeforeDst - (srcInUnlocked < unlockedBeforeDst ? 0 : 1))
      : unlockedBeforeDst;

    if (srcInUnlocked === dstInUnlocked) return; // no-op

    const newUnlocked = arrayMove(unlocked, srcInUnlocked, dstInUnlocked);

    // Re-assemble: walk the original positions, leave locked pills exactly
    // where they were, fill the gaps with newUnlocked in order.
    const newOrder = [];
    let cursor = 0;
    for (let pos = 0; pos < items.length; pos++) {
      if (locked.has(items[pos].id)) {
        newOrder.push(items[pos]);
      } else {
        newOrder.push(newUnlocked[cursor++]);
      }
    }

    // Detect newly-correct slots that should now lock.
    const newlyLocked = [];
    newOrder.forEach((it, pos) => {
      if (!locked.has(it.id) && it.text === words[pos]) newlyLocked.push(it);
    });

    setItems(newOrder);
    setMoves((m) => m + 1);

    if (newlyLocked.length > 0) {
      setLocked((prev) => {
        const next = new Set(prev);
        newlyLocked.forEach((it) => next.add(it.id));
        return next;
      });
      // Only surface the toast if the verse isn't fully solved by this
      // move — when it IS fully solved, the victory ceremony is the
      // feedback and a toast would just compete with it.
      const willBeSolved = newOrder.every((it, pos) => it.text === words[pos]);
      if (!willBeSolved) {
        const verb = newlyLocked.length > 1 ? "words" : "word";
        const count = newlyLocked.length > 1 ? `${newlyLocked.length} ` : "";
        showToast(`${count}${verb} placed correctly · locked`);
      }
    }
  };

  const reshuffle = () => {
    const fresh = shuffleArray(initialItems);
    const autoLocked = new Set();
    fresh.forEach((it, pos) => {
      if (it.text === words[pos]) autoLocked.add(it.id);
    });
    setItems(fresh);
    setLocked(autoLocked);
    setActiveId(null);
    setSolved(false);
    setMoves(0);
    setToast(null);
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  const dropAnimation = {
    duration: 320,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0" } },
    }),
  };

  const lockedCount = locked.size;
  const totalCount = items.length;

  return (
    <div className={`wog-card ${solved ? "is-solved" : ""}`}>
      {/* Floating toast — rendered above the card content */}
      {toast && (
        <div key={toast.key} className="wog-toast" role="status" aria-live="polite">
          <span className="wog-toast__chip" aria-hidden>
            <Check size={11} strokeWidth={3} />
          </span>
          {toast.text}
        </div>
      )}

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
              : `${lockedCount} / ${totalCount} locked`}
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
                  locked={locked.has(item.id)}
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
            Drop a word in its slot — it locks with a 🔒 and stays put while others rearrange.
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
