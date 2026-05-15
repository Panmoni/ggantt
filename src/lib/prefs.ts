export type FontScale = "s" | "m" | "l";

export const FONT_SCALES: FontScale[] = ["s", "m", "l"];

export const FONT_SCALE_LABEL: Record<FontScale, string> = {
  s: "S",
  m: "M",
  l: "L",
};

export const DEFAULT_FONT_SCALE: FontScale = "m";

const STORAGE_KEY = "ggantt:fontScale";

function isFontScale(v: unknown): v is FontScale {
  return v === "s" || v === "m" || v === "l";
}

export function loadFontScale(): FontScale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isFontScale(v) ? v : DEFAULT_FONT_SCALE;
  } catch {
    return DEFAULT_FONT_SCALE;
  }
}

export function saveFontScale(scale: FontScale): void {
  try {
    localStorage.setItem(STORAGE_KEY, scale);
  } catch {
    // localStorage unavailable (private mode / blocked) — ignore.
  }
}

export const DEFAULT_LEFT_WIDTH = 320;
export const MIN_LEFT_WIDTH = 200;
export const MAX_LEFT_WIDTH = 720;

const LEFT_WIDTH_KEY = "ggantt:leftWidth";

function clampLeftWidth(n: number): number {
  return Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, Math.round(n)));
}

export function loadLeftWidth(): number {
  try {
    const v = Number(localStorage.getItem(LEFT_WIDTH_KEY));
    return Number.isFinite(v) && v > 0 ? clampLeftWidth(v) : DEFAULT_LEFT_WIDTH;
  } catch {
    return DEFAULT_LEFT_WIDTH;
  }
}

export function saveLeftWidth(width: number): void {
  try {
    localStorage.setItem(LEFT_WIDTH_KEY, String(clampLeftWidth(width)));
  } catch {
    // localStorage unavailable (private mode / blocked) — ignore.
  }
}

export interface GanttMetrics {
  /** Tailwind text-size class for the issue identifier (e.g. ABCD-12). */
  idClass: string;
  /** Pixel height of one issue/group row, sized to fit its text. */
  rowH: number;
  /** Tailwind text-size class for the issue title (and inline rename input). */
  titleClass: string;
}

/**
 * Row height and text sizing for the Gantt issue list, per font scale.
 * "s" reproduces the original look; "m"/"l" dial it up. Row height grows
 * with the text so bars and labels stay vertically centred.
 */
export const GANTT_METRICS: Record<FontScale, GanttMetrics> = {
  s: { rowH: 30, titleClass: "text-xs", idClass: "text-[10px]" },
  m: { rowH: 36, titleClass: "text-sm", idClass: "text-xs" },
  l: { rowH: 44, titleClass: "text-base", idClass: "text-sm" },
};
