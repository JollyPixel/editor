// Import Internal Dependencies
import type {
  AtlasSize,
  ResolvedTileRef,
  ResolvedTilesetDefinition,
  TileRef,
  TilesetDefinition
} from "./types.ts";

export function resolveTileRef(
  ref: TileRef,
  defaultTilesetId?: string
): ResolvedTileRef {
  if (Array.isArray(ref)) {
    return {
      col: ref[0],
      row: ref[1],
      tilesetId: defaultTilesetId
    };
  }

  if (ref.tilesetId || !defaultTilesetId) {
    return { ...ref };
  }

  return {
    ...ref,
    tilesetId: defaultTilesetId
  };
}

export function resolveTilesetDefinition(
  def: TilesetDefinition,
  size: AtlasSize
): ResolvedTilesetDefinition {
  return {
    ...def,
    cols: def.cols ?? Math.floor(size.width / def.tileSize),
    rows: def.rows ?? Math.floor(size.height / def.tileSize)
  };
}
