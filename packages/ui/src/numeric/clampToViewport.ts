export interface ViewportRect {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ViewportPosition {
  x: number;
  y: number;
}

export interface ClampToViewportOptions {
  x: number;
  y: number;
  rect: ViewportRect;
  viewport: ViewportSize;
}

/**
 * Keeps a fixed-position rectangle reachable inside the viewport.
 */
export function clampToViewport({
  x,
  y,
  rect,
  viewport
}: ClampToViewportOptions): ViewportPosition {
  return {
    x: clampAxis(
      x,
      rect.width,
      viewport.width
    ),
    y: clampAxis(
      y,
      rect.height,
      viewport.height
    )
  };
}

function clampAxis(
  position: number,
  size: number,
  viewportSize: number
): number {
  if (size >= viewportSize) {
    return 0;
  }

  return Math.min(
    Math.max(position, 0),
    viewportSize - size
  );
}
