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

export type BlockTilesetStatus =
  | { kind: "assigned"; tilesetId: string; }
  | { kind: "mixed"; tilesetIds: string[]; }
  | { kind: "missing"; tilesetIds: string[]; }
  | { kind: "none"; };

export interface TilesetGrid {
  tileSize: number;
  width?: number;
  height?: number;
}

export interface TilesetAssignment {
  tilesetId: string;
  target: TilesetGrid;
  sourceOf: (tilesetId: string | undefined) => TilesetGrid | undefined;
  shape?: BlockShape;
  occupied?: Iterable<TileRect>;
}

export interface TilePosition {
  col: number;
  row: number;
}

export type ShapeLookup = (shapeId: string) => BlockShape | undefined;

type PixelPosition = Pick<TileRect, "x" | "y">;

interface MovingTile {
  ref: ResolvedTileRef;
  size: number;
  rect: TileRect;
  key: string;
}

export function blockTilesetStatus(
  block: ResolvedBlockDefinition,
  knownTilesetIds: ReadonlySet<string>
): BlockTilesetStatus {
  const textures = BlockTextures.of(block);
  const refs = [...textures];
  if (refs.length === 0) {
    return { kind: "none" };
  }

  const tilesetIds = textures.tilesetIds();
  if (
    refs.some((ref) => ref.tilesetId === undefined) ||
    tilesetIds.some((id) => !knownTilesetIds.has(id))
  ) {
    return { kind: "missing", tilesetIds };
  }
  if (tilesetIds.length > 1) {
    return { kind: "mixed", tilesetIds };
  }

  return { kind: "assigned", tilesetId: tilesetIds[0] };
}

export function blockFocusTilesetId(
  block: ResolvedBlockDefinition,
  knownTilesetIds: ReadonlySet<string>
): string | null {
  const status = blockTilesetStatus(block, knownTilesetIds);
  switch (status.kind) {
    case "assigned":
      return status.tilesetId;
    case "mixed":
      return status.tilesetIds[0];
    default:
      return null;
  }
}

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

export function blocksWithoutTileset(
  blocks: Iterable<ResolvedBlockDefinition>,
  knownTilesetIds: ReadonlySet<string>
): ResolvedBlockDefinition[] {
  return [...blocks].filter(
    (block) => blockTilesetStatus(block, knownTilesetIds).kind === "missing"
  );
}

export function assignBlockTileset(
  block: ResolvedBlockDefinition,
  assignment: TilesetAssignment
): ResolvedBlockDefinition {
  const { tilesetId, target } = assignment;
  const spans = tileRefSpans(block, assignment.shape);
  const moving: MovingTile[] = [];
  const occupied = [...assignment.occupied ?? []];
  for (const ref of BlockTextures.of(block)) {
    const span = spans.get(ref) ?? UNIT_TILE_SPAN;
    if (ref.tilesetId === tilesetId) {
      occupied.push(footprintRect(ref, target.tileSize, span));
      continue;
    }

    const sourceTileSize = assignment.sourceOf(ref.tilesetId)?.tileSize ??
      target.tileSize;
    const rect = footprintRect(ref, sourceTileSize, span);
    moving.push({
      ref,
      size: ref.size ?? sourceTileSize,
      rect,
      key: `${ref.tilesetId}:${rectKey(rect)}`
    });
  }
  if (moving.length === 0) {
    return block;
  }

  const unique = new Map(moving.map((tile) => [tile.key, tile.rect]));
  const keys = [...unique.keys()];
  const layout = groupLayout([...unique.values()], target);
  const origin = firstFreeOrigin(layout, target, occupied) ?? { x: 0, y: 0 };
  const placed = new Map<ResolvedTileRef, ResolvedTileRef>();
  for (const tile of moving) {
    const offset = layout[keys.indexOf(tile.key)];
    placed.set(tile.ref, movedTileRef(tile, assignment, {
      x: origin.x + offset.x,
      y: origin.y + offset.y
    }));
  }

  return BlockTextures.of(block)
    .map((ref) => placed.get(ref) ?? ref)
    .applyTo(block);
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

function movedTileRef(
  tile: MovingTile,
  assignment: TilesetAssignment,
  position: PixelPosition
): ResolvedTileRef {
  const { target } = assignment;
  const moved: ResolvedTileRef = {
    ...tile.ref,
    tilesetId: assignment.tilesetId,
    col: position.x / target.tileSize,
    row: position.y / target.tileSize
  };
  if (tile.size === target.tileSize && tile.ref.size === undefined) {
    delete moved.size;
  }
  else {
    moved.size = tile.size;
  }

  return moved;
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

function groupLayout(
  rects: TileRect[],
  target: TilesetGrid
): TileRect[] {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const relative = rects.map((rect) => {
    return {
      ...rect,
      x: rect.x - left,
      y: rect.y - top
    };
  });
  const keepsShape = relative.every((rect, index) => (
    rect.x % target.tileSize === 0 &&
    rect.y % target.tileSize === 0 &&
    rect.x + rect.width <= (target.width ?? Infinity) &&
    rect.y + rect.height <= (target.height ?? Infinity) &&
    relative.slice(index + 1).every((other) => !rectsOverlap(rect, other))
  ));

  return keepsShape ? relative : shelfLayout(rects, target);
}

function shelfLayout(
  rects: TileRect[],
  target: TilesetGrid
): TileRect[] {
  const { tileSize } = target;
  const maxWidth = target.width ?? Infinity;
  let x = 0;
  let y = 0;
  let shelfHeight = 0;

  return rects.map((rect) => {
    if (x > 0 && x + rect.width > maxWidth) {
      x = 0;
      y += shelfHeight;
      shelfHeight = 0;
    }

    const placed = { ...rect, x, y };
    x += alignUp(rect.width, tileSize);
    shelfHeight = Math.max(shelfHeight, alignUp(rect.height, tileSize));

    return placed;
  });
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
