// Import Internal Dependencies
import { MISSING_BLOCKSET_ID } from "../../../document/blocksets/missingBlockset.ts";
import type {
  ResolvedTileRef,
  TileRotation,
  TileSpan,
  AtlasUVRegion
} from "../../../document/blocksets/types.ts";
import type { AtlasUvSource } from "./types.ts";

export interface TileUv {
  region: AtlasUVRegion;
  rotation: TileRotation | undefined;
}

export function resolveTileUv(
  atlas: AtlasUvSource,
  tileRef: ResolvedTileRef,
  span: Readonly<TileSpan>
): TileUv {
  if (atlas.def.id === MISSING_BLOCKSET_ID) {
    return {
      region: atlas.computeTileUvRegion(0, 0),
      rotation: undefined
    };
  }

  return {
    region: atlas.computeTileUvRegion(
      tileRef.col,
      tileRef.row,
      tileRef.size,
      span,
      tileRef.rotation
    ),
    rotation: tileRef.rotation
  };
}
