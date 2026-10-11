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

export function classifyBlockRedefinition(
  previous: ResolvedBlockDefinition | undefined,
  next: ResolvedBlockDefinition
): BlockRedefinition {
  if (previous === undefined) {
    return "added";
  }
  if (occlusionKey(previous) !== occlusionKey(next)) {
    return "occlusion";
  }
  if (meshKey(previous, false) !== meshKey(next, false)) {
    return "mesh";
  }

  return meshKey(previous, true) === meshKey(next, true) ?
    "metadata" :
    "tiles";
}

function occlusionKey(
  block: ResolvedBlockDefinition
): string {
  return JSON.stringify([
    block.shapeId,
    block.alphaMode ?? "opaque",
    cullsCoveredFaces(block),
    block.blendGroup ?? null
  ]);
}

function meshKey(
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
    ([slot, tile]) => [slot, tileKey(tile, withTileRegions)]
  );

  return JSON.stringify([
    sortedEntries(meshed),
    defaultTexture && tileKey(defaultTexture, withTileRegions),
    faces
  ]);
}

function tileKey(
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
