// Import Third-party Dependencies
import type * as THREE from "three";
import {
  DEFAULT_TILE_SIZE,
  loadTilesets,
  type TilesetSource,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kOfflineTileset: TilesetDefinition = {
  id: "default",
  src: "textures/tileset.png",
  tileSize: DEFAULT_TILE_SIZE
};

export function preloadOfflineTilesets(
  manager: THREE.LoadingManager
): Promise<TilesetSource[]> {
  return loadTilesets([kOfflineTileset], { manager });
}
