// Import Internal Dependencies
import {
  cullsCoveredFaces,
  type ResolvedBlockDefinition
} from "./BlockDefinition.ts";
import type { ResolvedTileRef } from "../blocksets/types.ts";

export type BlockRedefinition =
  | "added"
  | "metadata"
  | "tiles"
  | "mesh"
  | "occlusion";

export function redefinitionOf(
  previous: ResolvedBlockDefinition | undefined,
  next: ResolvedBlockDefinition
): BlockRedefinition {
  if (previous === undefined) {
    return "added";
  }
  if (occlusionKeyOf(previous) !== occlusionKeyOf(next)) {
    return "occlusion";
  }
  if (meshKeyOf(previous, false) !== meshKeyOf(next, false)) {
    return "mesh";
  }

  return meshKeyOf(previous, true) === meshKeyOf(next, true) ?
    "metadata" :
    "tiles";
}

function occlusionKeyOf(
  block: ResolvedBlockDefinition
): string {
  return JSON.stringify([
    block.shapeId,
    block.alphaMode ?? "opaque",
    cullsCoveredFaces(block),
    block.blendGroup ?? null
  ]);
}

function meshKeyOf(
  block: ResolvedBlockDefinition,
  withTileRegions: boolean
): string {
  const {
    name: _name,
    properties: _properties,
    defaultTexture,
    faceTextures,
    ...meshed
  } = block;
  const faces = sortedEntries(faceTextures).map(
    ([slot, tile]) => [slot, tileKeyOf(tile, withTileRegions)]
  );

  return JSON.stringify([
    sortedEntries(meshed),
    defaultTexture && tileKeyOf(defaultTexture, withTileRegions),
    faces
  ]);
}

function tileKeyOf(
  tile: ResolvedTileRef,
  withRegion: boolean
): Array<string | number | null> {
  const frame = [tile.blocksetId ?? null, tile.rotation ?? 0];

  return withRegion ?
    [...frame, tile.col, tile.row, tile.size ?? null] :
    frame;
}

function sortedEntries<T>(
  record: Record<string, T>
): Array<[string, T]> {
  return Object.entries(record).sort(
    ([left], [right]) => (left < right ? -1 : 1)
  );
}
