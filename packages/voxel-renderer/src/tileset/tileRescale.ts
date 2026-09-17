// Import Internal Dependencies
import type { ResolvedTileRef } from "./types.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";
import {
  blockTileRefs,
  mapBlockTileRefs
} from "../blocks/blockTileRefs.ts";

export interface TileRescale {
  tilesetId: string;
  from: number;
  to: number;
}

export function rescaleTileRef(
  ref: ResolvedTileRef,
  rescale: TileRescale
): ResolvedTileRef {
  if (ref.tilesetId !== rescale.tilesetId) {
    return ref;
  }

  const ratio = rescale.from / rescale.to;

  return {
    ...ref,
    col: ref.col * ratio,
    row: ref.row * ratio,
    size: ref.size ?? rescale.from
  };
}

export function rescaleBlockTiles(
  block: ResolvedBlockDefinition,
  rescale: TileRescale
): ResolvedBlockDefinition {
  return mapBlockTileRefs(block, (ref) => rescaleTileRef(ref, rescale));
}

export function rescaleLeavesBlocksOffGrid(
  blocks: Iterable<ResolvedBlockDefinition>,
  rescale: TileRescale
): boolean {
  for (const block of blocks) {
    for (const ref of blockTileRefs(block)) {
      const moved = rescaleTileRef(ref, rescale);
      if (!Number.isInteger(moved.col) || !Number.isInteger(moved.row)) {
        return true;
      }
    }
  }

  return false;
}
