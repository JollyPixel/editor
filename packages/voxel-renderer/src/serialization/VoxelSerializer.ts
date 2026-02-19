// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type {
  TilesetManager,
  TilesetDefinition
} from "../tileset/TilesetManager.ts";
import type { VoxelEntry } from "../world/types.ts";
import type { BlockDefinition } from "../blocks/BlockDefinition.ts";

/**
 * x,y,z voxel positions are serialised as "x,y,z" keys in a sparse map for
 */
export type VoxelEntryKey = `${number},${number},${number}`;

/**
 * Flat key/value bag for custom object properties.
 * Complex types (color, object-ref, class) are intentionally omitted — only
 * primitive-scalar properties survive the round-trip.
 */
export type VoxelObjectProperties = Record<string, string | number | boolean>;

/**
 * A single named object placed in the world (spawn point, trigger zone, …).
 * Coordinates are in voxel/tile space (floats allowed for sub-tile precision).
 * Y is 0 for maps imported from a flat 2-D source.
 */
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
  properties?: VoxelObjectProperties;
}

/** A named layer that holds placed objects rather than voxel data. */
export interface VoxelObjectLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  objects: VoxelObjectJSON[];
}

export interface VoxelEntryJSON {
  block: number;
  transform: number;
}

export interface VoxelLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  offset?: { x: number; y: number; z: number; };
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}

export interface VoxelWorldJSON {
  version: 1;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  /**
   * Block definitions embedded by a converter so the file is self-contained.
   * Absent in files produced by VoxelSerializer.serialize() (the registry
   * lives in user code there); present in converter output.
   */
  blocks?: BlockDefinition[];
  layers: VoxelLayerJSON[];
  /** Named object layers (spawn points, triggers, etc.). */
  objectLayers?: VoxelObjectLayerJSON[];
}

/**
 * Serialises and deserialises a VoxelWorld to/from a plain JSON object.
 *
 * Format: sparse voxel map keyed by "x,y,z" strings for human readability and
 * easy diffing.  The version field allows future format migrations.
 */
export class VoxelSerializer {
  serialize(
    world: VoxelWorld,
    tilesetManager: TilesetManager
  ): VoxelWorldJSON {
    const layers: VoxelLayerJSON[] = [];

    for (const layer of world.getLayers()) {
      const voxels: Record<
        VoxelEntryKey,
        VoxelEntryJSON
      > = Object.create(null);

      for (const chunk of layer.getChunks()) {
        const wx0 = chunk.cx * world.chunkSize + layer.offset.x;
        const wy0 = chunk.cy * world.chunkSize + layer.offset.y;
        const wz0 = chunk.cz * world.chunkSize + layer.offset.z;

        for (const [idx, entry] of chunk.entries()) {
          const { lx, ly, lz } = chunk.fromLinearIndex(idx);
          const key: VoxelEntryKey = `${wx0 + lx},${wy0 + ly},${wz0 + lz}`;

          voxels[key] = {
            block: entry.blockId,
            transform: entry.transform
          };
        }
      }

      layers.push({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        order: layer.order,
        offset: { ...layer.offset },
        voxels
      });
    }

    return {
      version: 1,
      chunkSize: world.chunkSize,
      tilesets: tilesetManager.getDefinitions(),
      layers
    };
  }

  /**
   * Clears `world` and restores it from a serialised JSON snapshot.
   * Throws if the data version is not 1.
   */
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
      const layer = world.addLayer(layerJSON.name);

      // Override the auto-assigned id/order with the serialised values.
      layer.id = layerJSON.id;
      layer.order = layerJSON.order;
      layer.visible = layerJSON.visible;
      // Restore offset before voxels so setVoxelAt converts world keys correctly.
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
  }
}
