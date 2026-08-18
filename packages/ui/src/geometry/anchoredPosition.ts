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
  side?: "above" | "below" | "left" | "right";
  align?: "center" | "start";
}

/**
 * Places a panel against its anchor, flips to the opposite side when it
 * doesn't fit, and clamps it to the viewport. Oversized panels start at the
 * viewport edge. "above"/"below" run the flip along Y with X aligned to the
 * anchor (or centered); "left"/"right" mirror that along X with Y aligned.
 */
export function anchoredPosition({
  anchor,
  panel,
  viewport,
  gap,
  side = "below",
  align = "start"
}: AnchoredPositionOptions): ViewportPosition {
  return side === "left" || side === "right"
    ? anchoredHorizontal({
      anchor, panel, viewport, gap, side, align
    })
    : anchoredVertical({
      anchor, panel, viewport, gap, side, align
    });
}

function anchoredVertical({
  anchor,
  panel,
  viewport,
  gap,
  side,
  align
}: Required<Omit<AnchoredPositionOptions, "side">> & { side: "above" | "below"; }): ViewportPosition {
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

function anchoredHorizontal({
  anchor,
  panel,
  viewport,
  gap,
  side,
  align
}: Required<Omit<AnchoredPositionOptions, "side">> & { side: "left" | "right"; }): ViewportPosition {
  const right = anchor.right + gap;
  const left = anchor.left - gap - panel.width;
  const preferred = side === "left" ? left : right;
  const alternative = side === "left" ? right : left;
  const preferredFits = side === "left"
    ? preferred >= 0
    : preferred + panel.width <= viewport.width;
  const alternativeFits = side === "left"
    ? alternative + panel.width <= viewport.width
    : alternative >= 0;
  const x = !preferredFits && alternativeFits ? alternative : preferred;
  const y = align === "center"
    ? anchor.top + ((anchor.bottom - anchor.top - panel.height) / 2)
    : anchor.top;

  return clampToViewport({
    x,
    y,
    rect: panel,
    viewport
  });
}
