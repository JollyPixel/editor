// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import {
  VoxelLayer,
  type VoxelLayerConfigurableOptions
} from "./VoxelLayer.ts";
import { VoxelChunk, DEFAULT_CHUNK_SIZE } from "./VoxelChunk.ts";
import type { VoxelEntry, VoxelCoord } from "./types.ts";
import { FACE_OFFSETS } from "../mesh/math.ts";
import type { FACE } from "../utils/math.ts";

// CONSTANTS
let kLayerIdCounter = 0;

export type IterableLayerChunk = {
  layer: VoxelLayer;
  chunk: VoxelChunk;
};

/**
 * Top-level container for layered voxel data.
 *
 * Layers are composited top-to-bottom: when multiple layers contain a voxel at
 * the same world position, the one with the highest `order` value wins.
 * This allows decorative layers to override base terrain non-destructively.
 */
export class VoxelWorld {
  readonly chunkSize: number;

  #layers: VoxelLayer[] = [];
  #layersToRemove: VoxelLayer[] = [];

  constructor(
    chunkSize: number = DEFAULT_CHUNK_SIZE
  ) {
    this.chunkSize = chunkSize;
  }

  // --- Layer management --- //

  addLayer(
    name: string,
    options: VoxelLayerConfigurableOptions = {}
  ): VoxelLayer {
    const layer = new VoxelLayer({
      id: `layer_${kLayerIdCounter++}`,
      name,
      order: this.#layers.length,
      chunkSize: this.chunkSize,
      ...options
    });
    this.#layers.push(layer);
    this.#sortLayers();

    return layer;
  }

  updateLayer(
    name: string,
    options: Partial<VoxelLayerConfigurableOptions>
  ): boolean {
    const layer = this.getLayer(name);
    if (!layer) {
      return false;
    }

    if (options.properties) {
      layer.properties = structuredClone(options.properties);
    }
    if (options.visible !== undefined) {
      this.#updateLayerVisibility(layer, options.visible);
    }

    return true;
  }

  removeLayer(
    name: string
  ): boolean {
    const idx = this.#layers.findIndex(
      (layer) => layer.name === name
    );
    if (idx === -1) {
      return false;
    }

    const layer = this.#layers[idx];
    this.#layersToRemove.push(layer);
    this.#layers.splice(idx, 1);

    return true;
  }

  moveLayer(
    name: string,
    direction: "up" | "down"
  ): void {
    const idx = this.#layers.findIndex(
      (layer) => layer.name === name
    );
    if (idx === -1) {
      return;
    }

    const layer = this.#layers[idx];
    const delta = direction === "up" ? 1 : -1;
    const swapIdx = idx + delta;

    if (swapIdx < 0 || swapIdx >= this.#layers.length) {
      return;
    }

    // Swap order values, then re-sort.
    const temp = layer.order;
    layer.order = this.#layers[swapIdx].order;
    this.#layers[swapIdx].order = temp;
    this.#sortLayers();
  }

  setLayerVisible(
    name: string,
    visible: boolean
  ): void {
    const layer = this.getLayer(name);
    if (layer) {
      this.#updateLayerVisibility(layer, visible);
    }
  }

  #updateLayerVisibility(
    layer: VoxelLayer,
    visible: boolean
  ): void {
    layer.visible = visible;
    this.#markLayerDirty(layer);
  }

  setLayerOffset(
    name: string,
    offset: VoxelCoord
  ): void {
    const layer = this.getLayer(name);
    if (!layer) {
      return;
    }

    layer.offset = offset;
    this.#markAllLayersDirty();
  }

  translateLayer(
    name: string,
    delta: VoxelCoord
  ): void {
    const layer = this.getLayer(name);
    if (!layer) {
      return;
    }

    layer.offset = {
      x: layer.offset.x + delta.x,
      y: layer.offset.y + delta.y,
      z: layer.offset.z + delta.z
    };
    this.#markAllLayersDirty();
  }

  getLayers(): readonly VoxelLayer[] {
    return this.#layers;
  }

  getLayer(
    name: string
  ): VoxelLayer | undefined {
    return this.#layers.find(
      (layer) => layer.name === name
    );
  }

  // --- Composited voxel access --- //

  /**
   * Returns the voxel entry at (x, y, z) from the highest-priority visible
   * layer that has data there. Returns undefined for air.
   *
   * This is the function the mesh builder always calls for neighbour lookups,
   * giving it transparent cross-chunk and cross-layer visibility.
   */
  getVoxelAt(
    position: Vector3Like
  ): VoxelEntry | undefined {
    // Iterate from highest to lowest order (already sorted descending).
    for (const layer of this.#layers) {
      if (!layer.visible) {
        continue;
      }
      const entry = layer.getVoxelAt(position);
      if (entry !== undefined) {
        return entry;
      }
    }

    return undefined;
  }

  getVoxelNeighbour(
    position: Vector3Like,
    face: FACE
  ): VoxelEntry | undefined {
    const offset = FACE_OFFSETS[face];

    return this.getVoxelAt({
      x: position.x + offset[0],
      y: position.y + offset[1],
      z: position.z + offset[2]
    });
  }

  setVoxelAt(
    layerName: string,
    position: Vector3Like,
    entry: VoxelEntry
  ): void {
    const layer = this.getLayer(layerName);
    if (!layer) {
      throw new Error(`VoxelWorld: layer "${layerName}" does not exist.`);
    }

    layer.setVoxelAt(position, entry);

    // Mark neighbouring chunks dirty when a boundary voxel changes so their
    // faces are re-evaluated at the next update.
    this.#markNeighbourChunksDirty(layer, position);
  }

  removeVoxelAt(
    layerName: string,
    position: Vector3Like
  ): void {
    const layer = this.getLayer(layerName);
    if (!layer) {
      return;
    }

    layer.removeVoxelAt(position);
    this.#markNeighbourChunksDirty(layer, position);
  }

  // --- Chunk helpers --- //

  * getAllDirtyChunks(): IterableIterator<IterableLayerChunk> {
    for (const layer of this.#layers) {
      for (const chunk of layer.getChunks()) {
        if (chunk.dirty) {
          yield { layer, chunk };
        }
      }

      if (layer.wasVisible) {
        layer.wasVisible = false;
      }
    }
  }

  * getAllChunks(): IterableIterator<IterableLayerChunk> {
    for (const layer of this.#layers) {
      for (const chunk of layer.getChunks()) {
        yield { layer, chunk };
      }
    }
  }

  * getAllChunksToBeRemoved(): IterableIterator<IterableLayerChunk> {
    do {
      const layer = this.#layersToRemove.pop();
      if (!layer) {
        break;
      }
      if (!layer.visible && !layer.wasVisible) {
        continue;
      }

      for (const chunk of layer.getChunks()) {
        yield { layer, chunk };
      }
    } while (this.#layersToRemove.length > 0);
  }

  clear(): void {
    this.#layers = [];
  }

  #sortLayers(): void {
    // Highest order = highest priority (drawn/composited last, wins in getVoxelAt).
    this.#layers.sort((a, b) => b.order - a.order);
  }

  #markLayerDirty(
    layer: VoxelLayer
  ): void {
    for (const chunk of layer.getChunks()) {
      chunk.dirty = true;
    }
  }

  #markAllLayersDirty(): void {
    for (const layer of this.#layers) {
      this.#markLayerDirty(layer);
    }
  }

  /**
   * When a voxel on a chunk boundary changes, the adjacent chunk also needs its
   * mesh rebuilt so boundary faces are culled correctly.
   */
  #markNeighbourChunksDirty(
    layer: VoxelLayer,
    position: Vector3Like
  ): void {
    const s = this.chunkSize;
    // Subtract layer offset to get local-space position for chunk index math.
    const x = position.x - layer.offset.x;
    const y = position.y - layer.offset.y;
    const z = position.z - layer.offset.z;

    const cx = Math.floor(x / s);
    const cy = Math.floor(y / s);
    const cz = Math.floor(z / s);

    const lx = ((x % s) + s) % s;
    const ly = ((y % s) + s) % s;
    const lz = ((z % s) + s) % s;

    if (lx === 0) {
      layer.markChunkDirty(cx - 1, cy, cz);
    }
    if (lx === s - 1) {
      layer.markChunkDirty(cx + 1, cy, cz);
    }
    if (ly === 0) {
      layer.markChunkDirty(cx, cy - 1, cz);
    }
    if (ly === s - 1) {
      layer.markChunkDirty(cx, cy + 1, cz);
    }
    if (lz === 0) {
      layer.markChunkDirty(cx, cy, cz - 1);
    }
    if (lz === s - 1) {
      layer.markChunkDirty(cx, cy, cz + 1);
    }
  }
}
