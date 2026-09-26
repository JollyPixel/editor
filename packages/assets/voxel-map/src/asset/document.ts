// Import Third-party Dependencies
import {
  encodeVoxelDocument,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { VoxelMapState } from "./VoxelMapState.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";

export interface VoxelMapDocumentOptions {
  chunkSize: number;
  /**
   * Tileset links declared in order; each receives the first free slot.
   */
  tilesets?: Iterable<TilesetDefinition>;
  /**
   * @default "Ground"
   */
  layer?: string;
}

export function createVoxelMapDocument(
  options: VoxelMapDocumentOptions
): Uint8Array {
  const {
    chunkSize,
    tilesets = [],
    layer = kDefaultLayerName
  } = options;

  const state = new VoxelMapState(chunkSize);
  for (const tileset of tilesets) {
    state.tilesets.add(tileset);
  }
  state.world.addLayer(layer);

  return encodeVoxelDocument(state.toJSON());
}
