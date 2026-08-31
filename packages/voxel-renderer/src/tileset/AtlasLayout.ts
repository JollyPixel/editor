// Import Internal Dependencies
import type { TilesetUVRegion } from "./types.ts";

// CONSTANTS
const kMinPadding = 2;
const kMaxPadding = 8;

export interface AtlasLayoutOptions {
  cols: number;
  rows: number;
  tileSize: number;
  /**
   * Gutter in texels around every tile.
   * @default AtlasLayout.defaultPadding(tileSize)
   */
  padding?: number;
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

/**
 * Immutable tile grid of a render atlas. `AtlasRegion` and `sourceBounds()`
 * count source-image texels; everything else counts padded-canvas texels.
 */
export class AtlasLayout {
  /**
   * Scales gutter with tile size, clamped to limit atlas growth.
   */
  static defaultPadding(
    tileSize: number
  ): number {
    return Math.min(
      Math.max(Math.round(tileSize / 2), kMinPadding),
      kMaxPadding
    );
  }

  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly padding: number;

  /** Tile size plus one gutter on each side. */
  readonly cellSize: number;
  readonly paddedWidth: number;
  readonly paddedHeight: number;

  constructor(
    options: AtlasLayoutOptions
  ) {
    const {
      cols,
      rows,
      tileSize,
      padding = AtlasLayout.defaultPadding(tileSize)
    } = options;

    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;
    this.padding = padding;
    this.cellSize = tileSize + (padding * 2);
    this.paddedWidth = cols * this.cellSize;
    this.paddedHeight = rows * this.cellSize;

    Object.freeze(this);
  }

  /**
   * Whether there is a gutter to draw at all.
   */
  get isPadded(): boolean {
    return this.padding > 0 &&
      this.cols > 0 &&
      this.rows > 0 &&
      this.tileSize > 0;
  }

  withoutPadding(): AtlasLayout {
    if (this.padding === 0) {
      return this;
    }

    return new AtlasLayout({
      cols: this.cols,
      rows: this.rows,
      tileSize: this.tileSize,
      padding: 0
    });
  }

  sourceBounds(): AtlasRegion {
    return {
      x: 0,
      y: 0,
      width: this.cols * this.tileSize,
      height: this.rows * this.tileSize
    };
  }

  /**
   * Returns padded UVs with WebGL Y-flip and half-texel inset.
   */
  uvFor(
    col: number,
    row: number
  ): TilesetUVRegion {
    const {
      cellSize,
      padding,
      tileSize,
      rows,
      paddedWidth,
      paddedHeight
    } = this;

    return {
      offsetU: ((col * cellSize) + padding + 0.5) / paddedWidth,
      offsetV: ((rows - row - 1) * cellSize + padding + 0.5) / paddedHeight,
      scaleU: (tileSize - 1) / paddedWidth,
      scaleV: (tileSize - 1) / paddedHeight
    };
  }

  /**
   * Returns clamped tile bounds, assigning exact upper edges to the prior
   * tile, or null when nothing would be redrawn.
   */
  tileRangeWithin(
    bounds: AtlasRegion
  ): AtlasTileRange | null {
    const { cols, rows, tileSize } = this;

    if (!this.isPadded) {
      return null;
    }
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    const colStart = Math.floor(
      bounds.x / tileSize
    );
    const colEnd = Math.floor(
      (bounds.x + bounds.width - 1) / tileSize
    );
    const rowStart = Math.floor(
      bounds.y / tileSize
    );
    const rowEnd = Math.floor(
      (bounds.y + bounds.height - 1) / tileSize
    );

    if (
      colEnd < 0 ||
      rowEnd < 0 ||
      colStart > cols - 1 ||
      rowStart > rows - 1
    ) {
      return null;
    }

    return {
      colStart: Math.max(colStart, 0),
      colEnd: Math.min(colEnd, cols - 1),
      rowStart: Math.max(rowStart, 0),
      rowEnd: Math.min(rowEnd, rows - 1)
    };
  }
}
