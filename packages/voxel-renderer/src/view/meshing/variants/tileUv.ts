// Import Internal Dependencies
import { MISSING_TILESET_ID } from "../../../document/tilesets/missingTileset.ts";
import type {
  ResolvedTileRef,
  TileRotation,
  TileSpan,
  TilesetUVRegion
} from "../../../document/tilesets/types.ts";
import type { TilesetUvSource } from "./types.ts";

export interface TileUv {
  region: TilesetUVRegion;
  rotation: TileRotation | undefined;
}

export function tileUvOf(
  atlas: TilesetUvSource,
  tileRef: ResolvedTileRef,
  span: Readonly<TileSpan>
): TileUv {
  if (atlas.def.id === MISSING_TILESET_ID) {
    return {
      region: atlas.uvFor(0, 0),
      rotation: undefined
    };
  }

  return {
    region: atlas.uvFor(
      tileRef.col,
      tileRef.row,
      tileRef.size,
      span,
      tileRef.rotation
    ),
    rotation: tileRef.rotation
  };
}
