// Import Internal Dependencies
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import { VoxelLayer } from "../world/VoxelLayer.ts";
import type {
  IterableLayerChunk,
  VoxelWorld
} from "../world/VoxelWorld.ts";
import {
  voxelBlockId,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../world/packedVoxel.ts";
import type { MeshableWorld } from "./types.ts";

// CONSTANTS
const kNeighbourSpan = 3;
const kCellVoxels = 8;

export type MirroredChunkFn = (chunk: VoxelChunk) => boolean;

export class DownsampledWorld implements MeshableWorld {
  readonly chunkSize: number;
  readonly level: number;
  readonly scale: number;

  #source: VoxelWorld;
  #layers = new Map<VoxelLayer, VoxelLayer>();
  #revisions = new WeakMap<VoxelChunk, number>();
  #counts = new Int32Array(kCellVoxels);
  #cellVoxels = new Int32Array(kCellVoxels);

  constructor(
    source: VoxelWorld,
    level = 1
  ) {
    if (!Number.isInteger(level) || level < 1) {
      throw new RangeError(
        `DownsampledWorld: level must be a positive integer, got ${level}.`
      );
    }
    const chunkSize = source.chunkSize >> level;
    if (chunkSize < 1) {
      throw new RangeError(
        `DownsampledWorld: level ${level} exceeds a chunk size of ${source.chunkSize}.`
      );
    }

    this.#source = source;
    this.level = level;
    this.scale = 1 << level;
    this.chunkSize = chunkSize;
  }

  getLayers(): readonly VoxelLayer[] {
    const layers: VoxelLayer[] = [];
    const seen = new Set<VoxelLayer>();

    for (const source of this.#source.getLayers()) {
      seen.add(source);
      layers.push(this.#mirrorOf(source));
    }
    for (const source of this.#layers.keys()) {
      if (!seen.has(source)) {
        this.#layers.delete(source);
      }
    }

    return layers;
  }

  sync(
    members: readonly IterableLayerChunk[],
    coarse: MirroredChunkFn = () => true
  ): IterableLayerChunk[] {
    const mirrored: IterableLayerChunk[] = [];

    for (const { layer, chunk } of members) {
      const mirror = this.#mirrorOf(layer);
      for (let dx = -1; dx < kNeighbourSpan - 1; dx++) {
        for (let dy = -1; dy < kNeighbourSpan - 1; dy++) {
          for (let dz = -1; dz < kNeighbourSpan - 1; dz++) {
            this.#syncChunk(
              layer,
              mirror,
              chunk.cx + dx,
              chunk.cy + dy,
              chunk.cz + dz,
              (dx | dy | dz) === 0 ? () => true : coarse
            );
          }
        }
      }

      const mirrorChunk = mirror.getChunk(chunk.cx, chunk.cy, chunk.cz);
      if (mirrorChunk !== undefined && mirrorChunk.voxelCount > 0) {
        mirrored.push({
          layer: mirror,
          chunk: mirrorChunk
        });
      }
    }

    return mirrored;
  }

  #mirrorOf(
    source: VoxelLayer
  ): VoxelLayer {
    let mirror = this.#layers.get(source);
    if (mirror === undefined) {
      mirror = new VoxelLayer({
        id: source.id,
        name: source.name,
        order: source.order,
        chunkSize: this.chunkSize
      });
      this.#layers.set(source, mirror);
    }

    const { scale } = this;
    mirror.visible = source.visible;
    mirror.opacity = source.opacity;
    mirror.compositing = source.compositing;
    mirror.position.x = Math.floor(source.position.x / scale);
    mirror.position.y = Math.floor(source.position.y / scale);
    mirror.position.z = Math.floor(source.position.z / scale);

    return mirror;
  }

  // eslint-disable-next-line max-params
  #syncChunk(
    layer: VoxelLayer,
    mirror: VoxelLayer,
    cx: number,
    cy: number,
    cz: number,
    coarse: MirroredChunkFn
  ): void {
    const source = layer.getChunk(cx, cy, cz);
    if (source === undefined || source.voxelCount === 0 || !coarse(source)) {
      const stale = mirror.getChunk(cx, cy, cz);
      if (stale !== undefined && stale.voxelCount > 0) {
        stale.store.clear();
        stale.dirty = false;
        this.#revisions.delete(stale);
      }

      return;
    }

    const target = mirror.getOrCreateChunk(cx, cy, cz);
    if (this.#revisions.get(target) === source.revision) {
      return;
    }

    this.#resample(source, target);
    this.#revisions.set(target, source.revision);
  }

  #resample(
    source: VoxelChunk,
    target: VoxelChunk
  ): void {
    const { scale, chunkSize } = this;
    target.store.clear();

    for (let x = 0; x < chunkSize; x++) {
      for (let y = 0; y < chunkSize; y++) {
        for (let z = 0; z < chunkSize; z++) {
          const packed = this.#dominantVoxel(
            source,
            x * scale,
            y * scale,
            z * scale
          );
          if (packed !== VOXEL_ABSENT) {
            target.setPackedAt(x, y, z, packed);
          }
        }
      }
    }
    target.dirty = false;
  }

  // eslint-disable-next-line max-params
  #dominantVoxel(
    source: VoxelChunk,
    lx: number,
    ly: number,
    lz: number
  ): PackedVoxel {
    const { scale } = this;
    const voxels = this.#cellVoxels;
    const counts = this.#counts;
    let found = 0;

    for (let dx = 0; dx < scale; dx++) {
      for (let dy = 0; dy < scale; dy++) {
        for (let dz = 0; dz < scale; dz++) {
          const packed = source.getPackedAt(lx + dx, ly + dy, lz + dz);
          if (packed === VOXEL_ABSENT) {
            continue;
          }

          const blockId = voxelBlockId(packed);
          let slot = 0;
          while (slot < found && voxelBlockId(voxels[slot]) !== blockId) {
            slot++;
          }
          if (slot === found) {
            voxels[found] = packed;
            counts[found] = 0;
            found++;
          }
          counts[slot]++;
        }
      }
    }

    let best = VOXEL_ABSENT;
    let bestCount = 0;
    for (let slot = 0; slot < found; slot++) {
      if (counts[slot] > bestCount) {
        bestCount = counts[slot];
        best = voxels[slot];
      }
    }

    return best;
  }
}
