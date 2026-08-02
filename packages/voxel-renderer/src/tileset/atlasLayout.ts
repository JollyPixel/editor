// Import Internal Dependencies
import type { TilesetUVRegion } from "./types.ts";

// CONSTANTS
const kMinPadding = 2;
const kMaxPadding = 8;

export interface AtlasLayout {
  cols: number;
  rows: number;
  /** Tile width/height in the source atlas, in texels. */
  tileSize: number;
  /** Texels of gutter added on each side of every tile. */
  padding: number;
}

interface TileDrawOptions {
  /** Top-left of the tile in the source atlas. */
  sx: number;
  sy: number;
  /** Top-left of the tile body in the padded atlas. */
  dx: number;
  dy: number;
  tileSize: number;
  padding: number;
}

/**
 * Repacks an atlas by adding a `padding`-texel gutter copied from each tile edge.
 * This keeps MSAA UV overshoot sampling the same tile instead of neighbours.
 * Returns null when rasterization is unavailable (no DOM/2D context) or layout
 * values are invalid, so callers can keep the original atlas.
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
  // Gutters must be exact texel copies, never interpolations.
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
 * Size of one tile plus its gutters in the padded atlas.
 */
export function paddedCellSize(
  tileSize: number,
  padding: number
): number {
  return tileSize + (padding * 2);
}

/**
 * Default gutter for a tile size.
 * MSAA overshoot scales with tile size, so padding scales too.
 * Clamped to avoid excessive atlas memory growth.
 */
export function defaultPadding(
  tileSize: number
): number {
  return Math.min(Math.max(Math.round(tileSize / 2), kMinPadding), kMaxPadding);
}

/**
 * UV region for tile body (col, row) in a padded atlas.
 * Y is flipped for WebGL and UVs are inset by half a texel so edge vertices
 * sample texel centers, not borders. With `padding = 0`, this matches raw atlas
 * layout.
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
