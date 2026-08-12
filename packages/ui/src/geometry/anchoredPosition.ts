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
}

export interface AnchoredPositionOptions {
  anchor: AnchorRect;
  panel: ViewportSize;
  viewport: ViewportSize;
  gap: number;
}

/**
 * Places a panel below its anchor, flips it above when needed, and clamps it to
 * the viewport. Oversized panels start at the viewport edge.
 */
export function anchoredPosition({
  anchor,
  panel,
  viewport,
  gap
}: AnchoredPositionOptions): ViewportPosition {
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - panel.height;
  const overflowsBelow = below + panel.height > viewport.height;
  const y = overflowsBelow && above >= 0 ? above : below;

  return clampToViewport({
    x: anchor.left,
    y,
    rect: panel,
    viewport
  });
}
