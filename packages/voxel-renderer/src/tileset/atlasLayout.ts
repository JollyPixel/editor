// Import Internal Dependencies
import type { TilesetUVRegion } from "./types.ts";

// CONSTANTS
const kMinPadding = 2;
const kMaxPadding = 8;

export interface AtlasLayout {
  cols: number;
  rows: number;
  tileSize: number;
  padding: number;
}

export interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AtlasTileRange {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}

interface TileDrawOptions {
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  tileSize: number;
  padding: number;
}

/**
 * Repacks tiles with edge gutters and returns null when unavailable.
 */
export function padAtlas(
  image: CanvasImageSource,
  options: AtlasLayout
): HTMLCanvasElement | null {
  const { cols, rows, tileSize, padding } = options;
  if (padding <= 0 || cols <= 0 || rows <= 0 || tileSize <= 0) {
    return null;
  }
  if (typeof document === "undefined") {
    return null;
  }

  const cell = paddedCellSize(tileSize, padding);
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;

  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }
  // Disable interpolation so gutters copy exact texels.
  context.imageSmoothingEnabled = false;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      drawPaddedTile(context, image, {
        sx: col * tileSize,
        sy: row * tileSize,
        dx: (col * cell) + padding,
        dy: (row * cell) + padding,
        tileSize,
        padding
      });
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
  const { tileSize, padding } = layout;
  const range = atlasTileRange(layout, bounds);
  if (range === null) {
    return;
  }

  const context = target.getContext("2d");
  if (context === null) {
    return;
  }
  context.imageSmoothingEnabled = false;

  const cell = paddedCellSize(tileSize, padding);
  for (let row = range.rowStart; row <= range.rowEnd; row++) {
    for (let col = range.colStart; col <= range.colEnd; col++) {
      drawPaddedTile(context, image, {
        sx: col * tileSize,
        sy: row * tileSize,
        dx: (col * cell) + padding,
        dy: (row * cell) + padding,
        tileSize,
        padding
      });
    }
  }
}

/**
 * Returns clamped tile bounds, assigning exact upper edges to the prior tile.
 */
export function atlasTileRange(
  layout: AtlasLayout,
  bounds: AtlasRegion
): AtlasTileRange | null {
  const { cols, rows, tileSize, padding } = layout;
  if (padding <= 0 || cols <= 0 || rows <= 0 || tileSize <= 0) {
    return null;
  }
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const colStart = Math.floor(bounds.x / tileSize);
  const colEnd = Math.floor((bounds.x + bounds.width - 1) / tileSize);
  const rowStart = Math.floor(bounds.y / tileSize);
  const rowEnd = Math.floor((bounds.y + bounds.height - 1) / tileSize);

  if (colEnd < 0 || rowEnd < 0 || colStart > cols - 1 || rowStart > rows - 1) {
    return null;
  }

  return {
    colStart: Math.max(colStart, 0),
    colEnd: Math.min(colEnd, cols - 1),
    rowStart: Math.max(rowStart, 0),
    rowEnd: Math.min(rowEnd, rows - 1)
  };
}

export function paddedCellSize(
  tileSize: number,
  padding: number
): number {
  return tileSize + (padding * 2);
}

/**
 * Scales gutter with tile size, clamped to limit atlas growth.
 */
export function defaultPadding(
  tileSize: number
): number {
  return Math.min(Math.max(Math.round(tileSize / 2), kMinPadding), kMaxPadding);
}

/**
 * Returns padded UVs with WebGL Y-flip and half-texel inset.
 */
export function tileUVRegion(
  col: number,
  row: number,
  layout: AtlasLayout
): TilesetUVRegion {
  const { cols, rows, tileSize, padding } = layout;
  const cell = paddedCellSize(tileSize, padding);
  const imgW = cols * cell;
  const imgH = rows * cell;

  return {
    offsetU: (((col * cell) + padding + 0.5) / imgW),
    offsetV: ((rows * cell) - ((row + 1) * cell) + padding + 0.5) / imgH,
    scaleU: (tileSize - 1) / imgW,
    scaleV: (tileSize - 1) / imgH
  };
}

/**
 * Nine-slice copy: body, four edge strips, then four corners into the gutter.
 */
function drawPaddedTile(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  options: TileDrawOptions
): void {
  const { sx, sy, dx, dy, tileSize: size, padding } = options;
  const last = size - 1;

  context.drawImage(image, sx, sy, size, size, dx, dy, size, size);

  context.drawImage(image, sx, sy, 1, size, dx - padding, dy, padding, size);
  context.drawImage(image, sx + last, sy, 1, size, dx + size, dy, padding, size);
  context.drawImage(image, sx, sy, size, 1, dx, dy - padding, size, padding);
  context.drawImage(image, sx, sy + last, size, 1, dx, dy + size, size, padding);

  context.drawImage(image, sx, sy, 1, 1, dx - padding, dy - padding, padding, padding);
  context.drawImage(image, sx + last, sy, 1, 1, dx + size, dy - padding, padding, padding);
  context.drawImage(image, sx, sy + last, 1, 1, dx - padding, dy + size, padding, padding);
  context.drawImage(image, sx + last, sy + last, 1, 1, dx + size, dy + size, padding, padding);
}
