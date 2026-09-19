// Import Third-party Dependencies
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type {
  TilesetAssetReference,
  TilesetDefinition,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kLegacyAssetIdPattern = /^[^./:]+$/;

export function tilesetAsset(
  assetId: string
): TilesetAssetReference {
  return {
    id: assetId,
    kind: PIXEL_ART_KIND
  };
}

export function tilesetDependencies(
  tilesets: Iterable<TilesetDefinition>
): TilesetAssetReference[] {
  const references: TilesetAssetReference[] = [];
  for (const { asset } of tilesets) {
    if (asset !== undefined) {
      references.push({
        id: asset.id,
        kind: asset.kind
      });
    }
  }

  return references;
}

export function migrateTilesetDefinition(
  definition: TilesetDefinition
): TilesetDefinition {
  if (
    definition.asset !== undefined ||
    definition.src === undefined ||
    !kLegacyAssetIdPattern.test(definition.src)
  ) {
    return definition;
  }

  const { src, ...rest } = definition;

  return {
    ...rest,
    asset: tilesetAsset(src)
  };
}

export function migrateTilesetSources(
  document: VoxelWorldJSON
): VoxelWorldJSON {
  return {
    ...document,
    tilesets: document.tilesets.map(migrateTilesetDefinition)
  };
}
