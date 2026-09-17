// Import Internal Dependencies
import type { ResolvedTileRef } from "../tileset/types.ts";
import type { ResolvedBlockDefinition } from "./BlockDefinition.ts";

export type TileRefMapper = (ref: ResolvedTileRef) => ResolvedTileRef;

export function blockTileRefs(
  block: ResolvedBlockDefinition
): ResolvedTileRef[] {
  const refs = Object.values(block.faceTextures);
  if (block.defaultTexture !== undefined) {
    refs.push(block.defaultTexture);
  }

  return refs;
}

export function blockTilesetIds(
  block: ResolvedBlockDefinition
): string[] {
  const ids = new Set<string>();
  for (const ref of blockTileRefs(block)) {
    if (ref.tilesetId !== undefined) {
      ids.add(ref.tilesetId);
    }
  }

  return [...ids];
}

export function mapBlockTileRefs(
  block: ResolvedBlockDefinition,
  map: TileRefMapper
): ResolvedBlockDefinition {
  let changed = false;
  const faceTextures: Record<string, ResolvedTileRef> = {};
  for (const [slot, ref] of Object.entries(block.faceTextures)) {
    const next = map(ref);
    changed ||= next !== ref;
    faceTextures[slot] = next;
  }

  const defaultTexture = block.defaultTexture === undefined ?
    undefined :
    map(block.defaultTexture);
  changed ||= defaultTexture !== block.defaultTexture;
  if (!changed) {
    return block;
  }

  const mapped: ResolvedBlockDefinition = {
    ...block,
    faceTextures
  };
  if (defaultTexture === undefined) {
    delete mapped.defaultTexture;
  }
  else {
    mapped.defaultTexture = defaultTexture;
  }

  return mapped;
}

export function assignMissingTileset(
  block: ResolvedBlockDefinition,
  tilesetId: string | null
): ResolvedBlockDefinition {
  if (tilesetId === null) {
    return block;
  }

  return mapBlockTileRefs(block, (ref) => (
    ref.tilesetId === undefined ?
      {
        ...ref,
        tilesetId
      } :
      ref
  ));
}
