// Import Third-party Dependencies
import {
  BlockTextures,
  rescaleTileRef,
  resolvedBlockTextureSlots,
  tileFootprint,
  UNIT_TILE_SPAN,
  type BlockShape,
  type ResolvedBlockDefinition,
  type ResolvedTileRef,
  type TileRect,
  type TileRescale,
  type TileSpan
} from "@jolly-pixel/voxel.renderer";

export interface TilesetGrid {
  tileSize: number;
  width?: number;
  height?: number;
}

export interface TilePosition {
  col: number;
  row: number;
}

export type ShapeLookup = (shapeId: string) => BlockShape | undefined;

type PixelPosition = Pick<TileRect, "x" | "y">;

export function countBlocksPerTileset(
  blocks: Iterable<ResolvedBlockDefinition>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    for (const id of BlockTextures.of(block).tilesetIds()) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}

export function occupiedTileRects(
  blocks: Iterable<ResolvedBlockDefinition>,
  shapeOf: ShapeLookup,
  tilesetId: string,
  tileSize: number
): TileRect[] {
  const rects = new Map<string, TileRect>();
  for (const block of blocks) {
    const spans = tileRefSpans(block, shapeOf(block.shapeId));
    for (const ref of BlockTextures.of(block)) {
      if (ref.tilesetId !== tilesetId) {
        continue;
      }

      const rect = footprintRect(
        ref,
        tileSize,
        spans.get(ref) ?? UNIT_TILE_SPAN
      );
      rects.set(rectKey(rect), rect);
    }
  }

  return [...rects.values()];
}

export function firstFreeTile(
  grid: TilesetGrid,
  size: number,
  occupied: Iterable<TileRect>
): TilePosition {
  const rect: TileRect = {
    x: 0,
    y: 0,
    width: size,
    height: size
  };
  const origin = firstFreeOrigin([rect], grid, [...occupied]) ?? rect;

  return {
    col: origin.x / grid.tileSize,
    row: origin.y / grid.tileSize
  };
}

export function resizeBlockTiles(
  block: ResolvedBlockDefinition,
  size: number
): ResolvedBlockDefinition {
  return BlockTextures.of(block)
    .map((ref) => {
      return { ...ref, size };
    })
    .applyTo(block);
}

export function blockTileSize(
  block: ResolvedBlockDefinition
): number | undefined {
  const textures = BlockTextures.of(block);

  return (textures.defaultTexture ?? [...textures][0])?.size;
}

export function rescaleLeavesBlocksOffGrid(
  blocks: Iterable<ResolvedBlockDefinition>,
  rescale: TileRescale
): boolean {
  for (const block of blocks) {
    for (const ref of BlockTextures.of(block)) {
      const moved = rescaleTileRef(ref, rescale);
      if (!Number.isInteger(moved.col) || !Number.isInteger(moved.row)) {
        return true;
      }
    }
  }

  return false;
}

function tileRefSpans(
  block: ResolvedBlockDefinition,
  shape: BlockShape | undefined
): Map<ResolvedTileRef, Readonly<TileSpan>> {
  const spans = new Map<ResolvedTileRef, Readonly<TileSpan>>();
  if (shape === undefined) {
    return spans;
  }

  for (const { tile, span } of resolvedBlockTextureSlots(block, shape)) {
    const known = spans.get(tile) ?? UNIT_TILE_SPAN;
    spans.set(tile, {
      u: Math.max(known.u, span.u),
      v: Math.max(known.v, span.v)
    });
  }

  return spans;
}

function footprintRect(
  ref: ResolvedTileRef,
  tileSize: number,
  span: Readonly<TileSpan>
): TileRect {
  return {
    x: ref.col * tileSize,
    y: ref.row * tileSize,
    ...tileFootprint(ref.size ?? tileSize, span, ref.rotation)
  };
}

function rectKey(
  rect: TileRect
): string {
  return `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
}

function firstFreeOrigin(
  layout: TileRect[],
  grid: TilesetGrid,
  occupied: TileRect[]
): PixelPosition | null {
  const width = Math.max(...layout.map((rect) => rect.x + rect.width));
  const height = Math.max(...layout.map((rect) => rect.y + rect.height));
  const reach = occupiedReach(occupied, grid.tileSize);
  const maxX = Math.min((grid.width ?? Infinity) - width, reach.x);
  const maxY = Math.min((grid.height ?? Infinity) - height, reach.y);

  for (let y = 0; y <= maxY; y += grid.tileSize) {
    for (let x = 0; x <= maxX; x += grid.tileSize) {
      const free = layout.every((rect) => {
        const candidate = {
          ...rect,
          x: rect.x + x,
          y: rect.y + y
        };

        return occupied.every((other) => !rectsOverlap(candidate, other));
      });
      if (free) {
        return { x, y };
      }
    }
  }

  return null;
}

function occupiedReach(
  occupied: TileRect[],
  tileSize: number
): PixelPosition {
  const right = Math.max(0, ...occupied.map((rect) => rect.x + rect.width));
  const bottom = Math.max(0, ...occupied.map((rect) => rect.y + rect.height));

  return {
    x: alignUp(right, tileSize),
    y: alignUp(bottom, tileSize)
  };
}

function rectsOverlap(
  a: TileRect,
  b: TileRect
): boolean {
  return a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;
}

function alignUp(
  value: number,
  step: number
): number {
  return Math.ceil(value / step) * step;
}
