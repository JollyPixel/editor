// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type {
  VoxelLayerJSON
} from "../world/VoxelLayer.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import type { TilesetDefinition } from "../tileset/types.ts";
import type { VoxelEntry } from "../world/types.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";

export type VoxelObjectProperties = Record<string, string | number | boolean>;

export interface VoxelObjectJSON {
  id: string;
  name: string;
  type?: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible: boolean;
  color?: string;
  locked?: boolean;
  properties?: VoxelObjectProperties;
}

export interface VoxelObjectLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  objects: VoxelObjectJSON[];
}

export interface VoxelWorldJSON {
  version: 1;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  blocks?: ResolvedBlockDefinition[];
  layers: VoxelLayerJSON[];
  objectLayers?: VoxelObjectLayerJSON[];
}

export class VoxelSerializer {
  serialize(
    world: VoxelWorld,
    tilesetManager: TilesetManager
  ): VoxelWorldJSON {
    return {
      version: 1,
      chunkSize: world.chunkSize,
      tilesets: tilesetManager.definitions(),
      layers: world
        .getLayers()
        .map((layer) => layer.toJSON()),
      objectLayers: [...world.getObjectLayers()]
    };
  }

  deserialize(
    data: VoxelWorldJSON,
    world: VoxelWorld
  ): void {
    if (data.version !== 1) {
      throw new Error(`VoxelSerializer: unsupported version ${data.version}.`);
    }

    world.clear();

    // Re-create layers in order (sorted ascending so order numbers are stable).
    const sortedLayers = [...data.layers]
      .sort((a, b) => a.order - b.order);

    for (const layerJSON of sortedLayers) {
      const layer = world.addLayer(layerJSON.name, {
        visible: layerJSON.visible,
        opacity: layerJSON.opacity,
        properties: layerJSON.properties
      });

      // Override the auto-assigned id/order with the serialised values.
      layer.id = layerJSON.id;
      layer.order = layerJSON.order;
      if (layerJSON.offset) {
        layer.offset = { ...layerJSON.offset };
      }

      for (const [key, entryJSON] of Object.entries(layerJSON.voxels)) {
        const parts = key.split(",");
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const z = parseInt(parts[2], 10);

        if (
          Number.isNaN(x) ||
          Number.isNaN(y) ||
          Number.isNaN(z)
        ) {
          continue;
        }

        const entry: VoxelEntry = {
          blockId: entryJSON.block,
          transform: entryJSON.transform
        };
        layer.setVoxelAt({ x, y, z }, entry);
      }
    }

    for (const layerJSON of data.objectLayers ?? []) {
      const layer = world.addObjectLayer(layerJSON.name, {
        visible: layerJSON.visible,
        order: layerJSON.order
      });

      layer.id = layerJSON.id;
      layer.objects = [...layerJSON.objects];
    }
  }
}
