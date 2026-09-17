// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";

export interface VoxelLayerBlockStats {
  layerName: string;
  voxels: number;
  chunks: number;
}

export interface VoxelBlockStats {
  /**
   * Voxels stored in every layer, including hidden layers and voxels covered
   * by a `"replace"` layer.
   */
  voxels: number;
  layers: VoxelLayerBlockStats[];
  /**
   * Voxel count per block id, orphan ids included.
   */
  blocks: Map<number, number>;
  /**
   * Registered block ids no voxel uses, in registry order.
   */
  unusedBlocks: number[];
  /**
   * Block ids stored in the world but missing from the registry.
   */
  orphanBlocks: number[];
  orphanVoxels: number;
}

export interface VoxelLayerUsage {
  layerName: string;
  voxels: number;
}

export interface VoxelBlockUsage {
  blockId: number;
  voxels: number;
  /**
   * Layers holding at least one voxel of the block, in world layer order.
   */
  layers: VoxelLayerUsage[];
}

export interface VoxelTilesetUsage {
  tilesetId: string;
  /**
   * Registered block ids with at least one tile in the tileset.
   */
  blocks: number[];
  /**
   * Voxels whose block references the tileset.
   */
  voxels: number;
}

export interface VoxelBlockInspectorOptions {
  world: VoxelWorld;
  blockRegistry: BlockRegistry;
}

export class VoxelBlockInspector {
  #world: VoxelWorld;
  #blockRegistry: BlockRegistry;

  constructor(
    options: VoxelBlockInspectorOptions
  ) {
    this.#world = options.world;
    this.#blockRegistry = options.blockRegistry;
  }

  get stats(): VoxelBlockStats {
    const blocks = new Map<number, number>();
    const layers: VoxelLayerBlockStats[] = [];
    let voxels = 0;

    for (const layer of this.#world.getLayers()) {
      const layerVoxels = layer.voxelCount;
      voxels += layerVoxels;
      layers.push({
        layerName: layer.name,
        voxels: layerVoxels,
        chunks: layer.chunkCount
      });
      for (const [blockId, count] of layer.countBlocks()) {
        blocks.set(blockId, (blocks.get(blockId) ?? 0) + count);
      }
    }

    const unusedBlocks: number[] = [];
    for (const block of this.#blockRegistry) {
      if (!blocks.has(block.id)) {
        unusedBlocks.push(block.id);
      }
    }

    const orphanBlocks: number[] = [];
    let orphanVoxels = 0;
    for (const [blockId, count] of blocks) {
      if (!this.#blockRegistry.has(blockId)) {
        orphanBlocks.push(blockId);
        orphanVoxels += count;
      }
    }

    return {
      voxels,
      layers,
      blocks,
      unusedBlocks,
      orphanBlocks: orphanBlocks.sort((a, b) => a - b),
      orphanVoxels
    };
  }

  usageOf(
    blockId: number
  ): VoxelBlockUsage {
    const layers: VoxelLayerUsage[] = [];
    let voxels = 0;

    for (const layer of this.#world.getLayers()) {
      const count = layer.countBlock(blockId);
      if (count > 0) {
        voxels += count;
        layers.push({
          layerName: layer.name,
          voxels: count
        });
      }
    }

    return {
      blockId,
      voxels,
      layers
    };
  }

  tilesetUsageOf(
    tilesetId: string
  ): VoxelTilesetUsage {
    const blocks: number[] = [];
    for (const block of this.#blockRegistry) {
      if (BlockTextures.of(block).tilesetIds().includes(tilesetId)) {
        blocks.push(block.id);
      }
    }

    let voxels = 0;
    if (blocks.length > 0) {
      const counts = this.#world.countBlocks();
      for (const blockId of blocks) {
        voxels += counts.get(blockId) ?? 0;
      }
    }

    return {
      tilesetId,
      blocks,
      voxels
    };
  }
}
