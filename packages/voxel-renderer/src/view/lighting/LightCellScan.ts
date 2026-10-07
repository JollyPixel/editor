// Import Internal Dependencies
import type { VoxelChunk } from "../../document/world/storage/VoxelChunk.ts";
import {
  voxelBlockId,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../../document/world/storage/packedVoxel.ts";
import { isMergedVoxel } from "../../document/world/storage/mergedVoxel.ts";
import type { VoxelLayer } from "../../document/world/VoxelLayer.ts";
import type { VoxelWorld } from "../../document/world/VoxelWorld.ts";
import type { MeshableLayerVisibility } from "../meshing/types.ts";
import type { BlockLightSources } from "./BlockLightSources.ts";
import type {
  LightChunkKey,
  LightGrid
} from "./LightGrid.ts";
import {
  brightestLight,
  LIGHT_OPAQUE,
  PACKED_LIGHT_MASK
} from "./packedLight.ts";

export interface LightCellScanOptions {
  world: VoxelWorld;
  sources: BlockLightSources;
  visibility: MeshableLayerVisibility;
  grid: LightGrid;
}

export interface LightCells {
  opaque: Uint8Array;
  emitters: Map<number, number>;
}

export class LightCellScan {
  #world: VoxelWorld;
  #sources: BlockLightSources;
  #visibility: MeshableLayerVisibility;
  #grid: LightGrid;
  #lastBlockId = -1;
  #lastFlags = 0;

  constructor(
    options: LightCellScanOptions
  ) {
    this.#world = options.world;
    this.#sources = options.sources;
    this.#visibility = options.visibility;
    this.#grid = options.grid;
  }

  cellsOf(
    cx: number,
    cy: number,
    cz: number
  ): LightCells {
    const { size } = this.#grid;
    this.#lastBlockId = -1;
    const cells: LightCells = {
      opaque: new Uint8Array(this.#grid.cells),
      emitters: new Map()
    };
    const minX = cx * size;
    const minY = cy * size;
    const minZ = cz * size;

    for (const layer of this.#visibleLayers()) {
      const { x: px, y: py, z: pz } = layer.position;
      for (const source of this.#layerChunksOver(layer, minX, minY, minZ)) {
        const { shift, mask, partners } = source;
        const baseX = (source.cx * size) + px - minX;
        const baseY = (source.cy * size) + py - minY;
        const baseZ = (source.cz * size) + pz - minZ;
        const { keys, values, capacity } = source.store;

        for (let slot = 0; slot < capacity; slot++) {
          const key = keys[slot];
          if (key < 0) {
            continue;
          }

          const x = baseX + (key & mask);
          const y = baseY + ((key >> shift) & mask);
          const z = baseZ + (key >> (shift * 2));
          if (
            x < 0 || y < 0 || z < 0 ||
            x >= size || y >= size || z >= size
          ) {
            continue;
          }

          const index = this.#grid.localIndex(x, y, z);
          const packed = values[slot];
          this.#classify(packed, index, cells);
          if (partners !== null && isMergedVoxel(packed)) {
            this.#classify(partners.get(key), index, cells);
          }
        }
      }
    }

    return cells;
  }

  emittingKeys(): Set<LightChunkKey> {
    const keys = new Set<LightChunkKey>();
    for (const layer of this.#visibleLayers()) {
      for (const chunk of layer.getChunks()) {
        if (!this.#containsEmitter(chunk)) {
          continue;
        }
        for (const key of this.#grid.keysUnder(chunk, layer.position)) {
          keys.add(key);
        }
      }
    }

    return keys;
  }

  emitsOver(
    cx: number,
    cy: number,
    cz: number
  ): boolean {
    const { size } = this.#grid;
    for (const layer of this.#visibleLayers()) {
      const chunks = this.#layerChunksOver(
        layer,
        cx * size,
        cy * size,
        cz * size
      );
      for (const chunk of chunks) {
        if (this.#containsEmitter(chunk)) {
          return true;
        }
      }
    }

    return false;
  }

  #containsEmitter(
    chunk: VoxelChunk
  ): boolean {
    for (const blockId of chunk.countBlocks().keys()) {
      if (this.#sources.emissionOf(blockId) !== 0) {
        return true;
      }
    }

    return false;
  }

  * #visibleLayers(): IterableIterator<VoxelLayer> {
    for (const layer of this.#world.getLayers()) {
      if (this.#visibility.isVisible(layer)) {
        yield layer;
      }
    }
  }

  #classify(
    voxel: PackedVoxel,
    index: number,
    cells: LightCells
  ): void {
    if (voxel === VOXEL_ABSENT) {
      return;
    }

    const blockId = voxelBlockId(voxel);
    if (blockId !== this.#lastBlockId) {
      this.#lastBlockId = blockId;
      this.#lastFlags = this.#sources.flagsOf(blockId);
    }
    const flags = this.#lastFlags;
    if ((flags & LIGHT_OPAQUE) !== 0) {
      cells.opaque[index] = 1;
    }

    const light = flags & PACKED_LIGHT_MASK;
    if (light !== 0) {
      cells.emitters.set(
        index,
        brightestLight(cells.emitters.get(index) ?? 0, light)
      );
    }
  }

  * #layerChunksOver(
    layer: VoxelLayer,
    minX: number,
    minY: number,
    minZ: number
  ): IterableIterator<VoxelChunk> {
    const { x: px, y: py, z: pz } = layer.position;
    const coords = this.#grid.chunksCovering(
      minX - px,
      minY - py,
      minZ - pz,
      this.#grid.size
    );
    for (const [cx, cy, cz] of coords) {
      const chunk = layer.getChunk(cx, cy, cz);
      if (chunk !== undefined && !chunk.isEmpty()) {
        yield chunk;
      }
    }
  }
}
