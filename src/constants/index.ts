// ── Shared constants ────────────────────────────────────────────────
// Centralised magic values used across the student-facing UI.
// Import from "@/constants" (configured via tsconfig paths → src/).

// Colors used in inline styles (NOT Tailwind classes).
export const COLORS = {
  BROWN_DARK: "#2A1F12",
  GOLD: "#F4C95D",
  GOLD_GRADIENT: "linear-gradient(90deg, #F4C95D, #D4A574)",
  CREAM_LIGHT: "#F5EFE5",
  MEANING_HIGHLIGHT_BG: "#F5E6D0",
  MEANING_HIGHLIGHT_TEXT: "#6B4226",
} as const;

// Playback speed options shown in the shloka player.
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const;

// Minimum horizontal pixel delta to register a swipe gesture.
export const SWIPE_THRESHOLD_PX = 30;

// Serif font stack used for Sanskrit / Devanagari display.
export const SANSKRIT_FONT_FAMILY = "Georgia, serif";
