// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { VoxelEntry } from "../world/types.ts";

// CONSTANTS
// A region one chunk wide plus a one-voxel border spans at most 3 chunks per axis.
const kSpan = 3;

/**
 * Per-layer voxel lookup over a prefetched 3×3×3 block of chunks.
 *
 * `VoxelLayer.getVoxelAt()` builds a `"cx,cy,cz"` string and hashes it on every
 * call; the mesh builder makes one call per voxel face, so resolving the chunks
 * once up front turns the hot lookup into pure integer arithmetic.
 */
export class LayerChunkCache {
  readonly layer: VoxelLayer;
  /** Translucent layers never occlude a neighbouring face. */
  readonly opaque: boolean;
  /** True when the layer holds no chunk anywhere in the prefetched window. */
  readonly empty: boolean = true;

  #size: number;
  /** log2(size) when the chunk size is a power of two, -1 otherwise. */
  #shift: number;
  #offsetX: number;
  #offsetY: number;
  #offsetZ: number;
  #baseCx: number;
  #baseCy: number;
  #baseCz: number;
  #chunks: (VoxelChunk | undefined)[] = [];

  // eslint-disable-next-line max-params
  constructor(
    layer: VoxelLayer,
    chunkSize: number,
    minWx: number,
    minWy: number,
    minWz: number
  ) {
    this.layer = layer;
    this.opaque = layer.opacity >= 1;

    this.#size = chunkSize;
    this.#shift = (chunkSize & (chunkSize - 1)) === 0 ?
      Math.log2(chunkSize) :
      -1;

    const { offset } = layer;
    this.#offsetX = offset.x;
    this.#offsetY = offset.y;
    this.#offsetZ = offset.z;

    this.#baseCx = Math.floor((minWx - offset.x) / chunkSize);
    this.#baseCy = Math.floor((minWy - offset.y) / chunkSize);
    this.#baseCz = Math.floor((minWz - offset.z) / chunkSize);

    for (let dx = 0; dx < kSpan; dx++) {
      for (let dy = 0; dy < kSpan; dy++) {
        for (let dz = 0; dz < kSpan; dz++) {
          const chunk = layer.getChunk(
            this.#baseCx + dx,
            this.#baseCy + dy,
            this.#baseCz + dz
          );
          this.#chunks[(dx * 9) + (dy * kSpan) + dz] = chunk;

          if (chunk !== undefined) {
            this.empty = false;
          }
        }
      }
    }
  }

  entryAt(
    wx: number,
    wy: number,
    wz: number
  ): VoxelEntry | undefined {
    const size = this.#size;
    const shift = this.#shift;
    const x = wx - this.#offsetX;
    const y = wy - this.#offsetY;
    const z = wz - this.#offsetZ;

    let cx: number;
    let cy: number;
    let cz: number;
    let lx: number;
    let ly: number;
    let lz: number;

    if (shift >= 0) {
      const mask = size - 1;
      cx = x >> shift;
      cy = y >> shift;
      cz = z >> shift;
      lx = x & mask;
      ly = y & mask;
      lz = z & mask;
    }
    else {
      cx = Math.floor(x / size);
      cy = Math.floor(y / size);
      cz = Math.floor(z / size);
      lx = x - (cx * size);
      ly = y - (cy * size);
      lz = z - (cz * size);
    }

    const dx = cx - this.#baseCx;
    const dy = cy - this.#baseCy;
    const dz = cz - this.#baseCz;

    // Outside the prefetched window only when a caller queries beyond the
    // one-voxel border the cache was built for; fall back to the layer.
    const chunk = (dx | dy | dz) >= 0 && dx < kSpan && dy < kSpan && dz < kSpan ?
      this.#chunks[(dx * 9) + (dy * kSpan) + dz] :
      this.layer.getChunk(cx, cy, cz);

    if (chunk === undefined || !chunk.mayContain(lx, ly, lz)) {
      return undefined;
    }

    return chunk.getAt(lx, ly, lz);
  }
}

/**
 * Every effectively visible layer of the world, in compositing order (highest
 * priority first), each prefetched around the chunk being built.
 *
 * Mirrors the filtering `VoxelWorld.getVoxelWithLayerAt()` applies: a layer
 * that is hidden or fully transparent neither wins compositing nor occludes.
 */
export class ChunkNeighbourhood {
  readonly layers: readonly LayerChunkCache[];

  // eslint-disable-next-line max-params
  constructor(
    world: VoxelWorld,
    minWx: number,
    minWy: number,
    minWz: number
  ) {
    const layers: LayerChunkCache[] = [];

    for (const layer of world.getLayers()) {
      if (!layer.visible || layer.opacity === 0) {
        continue;
      }

      const cache = new LayerChunkCache(
        layer, world.chunkSize, minWx, minWy, minWz
      );
      // A layer with no chunk in the window can neither win compositing nor
      // occlude anywhere the builder looks, so it is dropped from the walk.
      if (!cache.empty) {
        layers.push(cache);
      }
    }

    this.layers = layers;
  }

  indexOf(
    layer: VoxelLayer
  ): number {
    return this.layers.findIndex(
      (cache) => cache.layer === layer
    );
  }
}
