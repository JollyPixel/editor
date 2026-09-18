// Import Third-party Dependencies
import {
  BlockTextures,
  rescaleTileRef,
  type ResolvedBlockDefinition,
  type ResolvedTileRef,
  type TileRescale
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
  return BlockTextures.of(block)
    .map((ref) => (
      ref.tilesetId === assignment.tilesetId ?
        ref :
        moveTileRef(ref, assignment)
    ))
    .applyTo(block);
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

function moveTileRef(
  ref: ResolvedTileRef,
  assignment: TilesetAssignment
): ResolvedTileRef {
  const { target } = assignment;
  const source = assignment.sourceOf(ref.tilesetId);
  const sourceTileSize = source?.tileSize ?? target.tileSize;
  const size = ref.size ?? sourceTileSize;
  const x = clamp(ref.col * sourceTileSize, size, target.width);
  const y = clamp(ref.row * sourceTileSize, size, target.height);

  const moved: ResolvedTileRef = {
    ...ref,
    tilesetId: assignment.tilesetId,
    col: x / target.tileSize,
    row: y / target.tileSize
  };
  if (size === target.tileSize && ref.size === undefined) {
    delete moved.size;
  }
  else {
    moved.size = size;
  }

  return moved;
}

function clamp(
  position: number,
  size: number,
  extent: number | undefined
): number {
  if (extent === undefined) {
    return Math.max(0, position);
  }

  return Math.max(0, Math.min(position, extent - size));
}
