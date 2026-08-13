// Import Internal Dependencies
import {
  clampToViewport,
  type ViewportPosition,
  type ViewportSize
} from "./clampToViewport.ts";

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface AnchoredPositionOptions {
  anchor: AnchorRect;
  panel: ViewportSize;
  viewport: ViewportSize;
  gap: number;
  side?: "above" | "below";
  align?: "center" | "start";
}

/**
 * Places a panel below its anchor, flips it above when needed, and clamps it to
 * the viewport. Oversized panels start at the viewport edge.
 */
export function anchoredPosition({
  anchor,
  panel,
  viewport,
  gap,
  side = "below",
  align = "start"
}: AnchoredPositionOptions): ViewportPosition {
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - panel.height;
  const preferred = side === "above" ? above : below;
  const alternative = side === "above" ? below : above;
  const preferredFits = side === "above"
    ? preferred >= 0
    : preferred + panel.height <= viewport.height;
  const alternativeFits = side === "above"
    ? alternative + panel.height <= viewport.height
    : alternative >= 0;
  const y = !preferredFits && alternativeFits ? alternative : preferred;
  const x = align === "center"
    ? anchor.left + ((anchor.right - anchor.left - panel.width) / 2)
    : anchor.left;

  return clampToViewport({
    x,
    y,
    rect: panel,
    viewport
  });
}
