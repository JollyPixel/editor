// Import Third-party Dependencies
import type * as THREE from "three";
import {
  loadTilesets,
  type TilesetSource,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer";
import type { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { parseVoxelWorld } from "../../features/map-config/parseVoxelWorld.ts";

// CONSTANTS
const kFallbackTileset: TilesetDefinition = {
  id: "default",
  src: "textures/tileset.png",
  tileSize: 32
};

export async function preloadTilesets(
  record: AssetRecord | undefined,
  manager: THREE.LoadingManager
): Promise<TilesetSource[]> {
  const source = await record?.text();
  const tilesets = source ? parseVoxelWorld(source).tilesets : [];

  return loadTilesets(
    tilesets.length > 0 ? tilesets : [kFallbackTileset],
    { manager }
  );
}
