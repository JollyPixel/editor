// Import Internal Dependencies
import type {
  AtlasLayout,
  AtlasRegion
} from "./AtlasLayout.ts";

/**
 * Repacks tiles with edge gutters and returns null when unavailable.
 */
export function padAtlas(
  image: CanvasImageSource,
  layout: AtlasLayout
): HTMLCanvasElement | null {
  if (!layout.isPadded) {
    return null;
  }
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = layout.paddedWidth;
  canvas.height = layout.paddedHeight;

  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }
  // Disable interpolation so gutters copy exact texels.
  context.imageSmoothingEnabled = false;

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      drawPaddedTile(context, image, layout, col, row);
    }
  }

  return canvas;
}

/**
 * Repads touched tiles in place; invalid bounds leave the target unchanged.
 */
export function padAtlasRegion(
  target: HTMLCanvasElement,
  image: CanvasImageSource,
  layout: AtlasLayout,
  bounds: AtlasRegion
): void {
  const range = layout.tileRangeWithin(bounds);
  if (range === null) {
    return;
  }

  const context = target.getContext("2d");
  if (context === null) {
    return;
  }
  context.imageSmoothingEnabled = false;

  for (let row = range.rowStart; row <= range.rowEnd; row++) {
    for (let col = range.colStart; col <= range.colEnd; col++) {
      drawPaddedTile(context, image, layout, col, row);
    }
  }
}

/**
 * Nine-slice copy: body, four edge strips, then four corners into the gutter.
 */
function drawPaddedTile(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  layout: AtlasLayout,
  col: number,
  row: number
): void {
  const { tileSize: size, padding, cellSize } = layout;

  const sx = col * size;
  const sy = row * size;
  const dx = (col * cellSize) + padding;
  const dy = (row * cellSize) + padding;
  const last = size - 1;

  context.drawImage(
    image, sx, sy, size, size, dx, dy, size, size
  );
  context.drawImage(
    image, sx, sy, 1, size, dx - padding, dy, padding, size
  );
  context.drawImage(
    image, sx + last, sy, 1, size, dx + size, dy, padding, size
  );
  context.drawImage(
    image, sx, sy, size, 1, dx, dy - padding, size, padding
  );
  context.drawImage(
    image, sx, sy + last, size, 1, dx, dy + size, size, padding
  );
  context.drawImage(
    image, sx, sy, 1, 1, dx - padding, dy - padding, padding, padding
  );
  context.drawImage(
    image, sx + last, sy, 1, 1, dx + size, dy - padding, padding, padding
  );
  context.drawImage(
    image, sx, sy + last, 1, 1, dx - padding, dy + size, padding, padding
  );
  context.drawImage(
    image, sx + last, sy + last, 1, 1, dx + size, dy + size, padding, padding
  );
}
