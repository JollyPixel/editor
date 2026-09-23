// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { VoxelLayer } from "./VoxelLayer.ts";
import {
  VOXEL_ABSENT,
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "./packedVoxel.ts";
import type { VoxelCellChange } from "./types.ts";
import {
  VOXEL_PATCH_STRIDE,
  type VoxelPatchCells
} from "./voxelPatch.ts";

// CONSTANTS
const kFaceMinX = 1;
const kFaceMaxX = 2;
const kFaceMinY = 4;
const kFaceMaxY = 8;
const kFaceMinZ = 16;
const kFaceMaxZ = 32;
const kChunkBias = 1 << 16;
const kChunkSpan = kChunkBias * 2;
const kUntouched = -2;

/**
 * Changed cells of one chunk, indexed by local cell index. `order` keeps the
 * first-write order; `origin` is the chunk's world-space corner when its
 * first pending cell was written.
 */
interface TrackedCells {
  before: Int32Array;
  after: Int32Array;
  recorded: Uint8Array;
  order: number[];
  originX: number;
  originY: number;
  originZ: number;
}

interface TouchedChunk {
  cx: number;
  cy: number;
  cz: number;
  faces: number;
  cells: TrackedCells | null;
}

export interface VoxelEditBatchFlush {
  layer: VoxelLayer;
  cells: VoxelPatchCells;
  changes: VoxelCellChange[];
}

interface WorldBox {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface VoxelEditWriteOptions {
  /**
   * Keep the cell so it can be emitted and recorded when the batch flushes.
   */
  track: boolean;
  /**
   * Hand the cell to the history recorder when the batch flushes.
   */
  record: boolean;
}

/**
 * Collects voxel writes so dirty chunks are marked once per touched chunk
 * and changed cells are coalesced, last write wins, until the batch flushes.
 */
export class VoxelEditBatch {
  #size: number;
  #shift: number;
  #mask: number;
  #layers = new Map<VoxelLayer, Map<number, TouchedChunk>>();
  #pendingCells = 0;

  #lastLayer: VoxelLayer | null = null;
  #lastKey = -1;
  #lastChunk: TouchedChunk | null = null;

  constructor(
    chunkSize: number
  ) {
    this.#size = chunkSize;
    this.#shift = Math.log2(chunkSize);
    this.#mask = chunkSize - 1;
  }

  get hasPendingCells(): boolean {
    return this.#pendingCells > 0;
  }

  write(
    layer: VoxelLayer,
    position: Vector3Like,
    packed: PackedVoxel,
    options: VoxelEditWriteOptions
  ): void {
    const x = position.x - layer.position.x;
    const y = position.y - layer.position.y;
    const z = position.z - layer.position.z;
    const touched = this.#touch(layer, x, y, z);
    if (!options.track) {
      this.#store(layer, position, packed);

      return;
    }

    const size = this.#size;
    const lx = x & this.#mask;
    const ly = y & this.#mask;
    const lz = z & this.#mask;
    const cells = this.#trackedCells(layer, touched);
    const index = lx + (size * (ly + (size * lz)));
    if (cells.before[index] === kUntouched) {
      const chunk = layer.getChunk(touched.cx, touched.cy, touched.cz);
      cells.before[index] = chunk === undefined ?
        VOXEL_ABSENT :
        chunk.getPackedAt(lx, ly, lz);
      cells.recorded[index] = options.record ? 1 : 0;
      cells.order.push(index);
      this.#pendingCells++;
    }
    cells.after[index] = packed;
    this.#store(layer, position, packed);
  }

  touch(
    layer: VoxelLayer,
    position: Vector3Like
  ): void {
    this.#touch(
      layer,
      position.x - layer.position.x,
      position.y - layer.position.y,
      position.z - layer.position.z
    );
  }

  /**
   * Coordinates are layer-local.
   */
  #touch(
    layer: VoxelLayer,
    x: number,
    y: number,
    z: number
  ): TouchedChunk {
    const touched = this.#chunkOf(
      layer,
      x >> this.#shift,
      y >> this.#shift,
      z >> this.#shift
    );

    const lx = x & this.#mask;
    const ly = y & this.#mask;
    const lz = z & this.#mask;
    const last = this.#size - 1;
    if (lx === 0) {
      touched.faces |= kFaceMinX;
    }
    if (lx === last) {
      touched.faces |= kFaceMaxX;
    }
    if (ly === 0) {
      touched.faces |= kFaceMinY;
    }
    if (ly === last) {
      touched.faces |= kFaceMaxY;
    }
    if (lz === 0) {
      touched.faces |= kFaceMinZ;
    }
    if (lz === last) {
      touched.faces |= kFaceMaxZ;
    }

    return touched;
  }

  /**
   * Yields the changed cells of each layer as a patch, plus the history
   * changes of the recorded ones, then forgets them. Cells whose value ended
   * up unchanged are skipped.
   */
  * drain(): IterableIterator<VoxelEditBatchFlush> {
    if (this.#pendingCells === 0) {
      return;
    }
    this.#pendingCells = 0;

    for (const [layer, chunks] of this.#layers) {
      let pending = 0;
      for (const touched of chunks.values()) {
        pending += touched.cells?.order.length ?? 0;
      }
      if (pending === 0) {
        continue;
      }

      const flush: VoxelEditBatchFlush = {
        layer,
        cells: new Array(pending * VOXEL_PATCH_STRIDE),
        changes: []
      };
      let written = 0;
      for (const touched of chunks.values()) {
        if (touched.cells !== null) {
          written = this.#drainChunk(touched.cells, flush, written);
        }
      }
      flush.cells.length = written;

      if (written > 0) {
        yield flush;
      }
    }
  }

  /**
   * Marks, in every layer, the chunks overlapping each touched chunk and the
   * one-voxel slab past each face a write landed on.
   */
  markDirty(
    layers: readonly VoxelLayer[]
  ): void {
    for (const [edited, chunks] of this.#layers) {
      if (!layers.includes(edited)) {
        continue;
      }

      for (const touched of chunks.values()) {
        for (const box of this.#dirtyBoxes(edited, touched)) {
          for (const layer of layers) {
            this.#markBox(layer, box);
          }
        }
      }
    }
  }

  #drainChunk(
    tracked: TrackedCells,
    flush: VoxelEditBatchFlush,
    offset: number
  ): number {
    const shift = this.#shift;
    const mask = this.#mask;
    const { before, after, recorded, order } = tracked;
    const { cells } = flush;
    let written = offset;

    for (const index of order) {
      const from = before[index];
      const to = after[index];
      before[index] = kUntouched;
      if (from === to) {
        continue;
      }

      const x = tracked.originX + (index & mask);
      const y = tracked.originY + ((index >> shift) & mask);
      const z = tracked.originZ + (index >> (shift * 2));
      const absent = to === VOXEL_ABSENT;
      cells[written] = x;
      cells[written + 1] = y;
      cells[written + 2] = z;
      cells[written + 3] = absent ? 0 : voxelBlockId(to);
      cells[written + 4] = absent ? 0 : voxelTransform(to);
      written += VOXEL_PATCH_STRIDE;
      if (recorded[index] === 1) {
        flush.changes.push({
          layerName: flush.layer.name,
          position: { x, y, z },
          before: from,
          after: to
        });
      }
    }
    order.length = 0;

    return written;
  }

  #trackedCells(
    layer: VoxelLayer,
    touched: TouchedChunk
  ): TrackedCells {
    const volume = this.#size ** 3;
    touched.cells ??= {
      before: new Int32Array(volume).fill(kUntouched),
      after: new Int32Array(volume),
      recorded: new Uint8Array(volume),
      order: [],
      originX: 0,
      originY: 0,
      originZ: 0
    };

    const { cells } = touched;
    if (cells.order.length === 0) {
      cells.originX = layer.position.x + (touched.cx * this.#size);
      cells.originY = layer.position.y + (touched.cy * this.#size);
      cells.originZ = layer.position.z + (touched.cz * this.#size);
    }

    return cells;
  }

  #store(
    layer: VoxelLayer,
    position: Vector3Like,
    packed: PackedVoxel
  ): void {
    if (packed === VOXEL_ABSENT) {
      layer.removeVoxelAt(position);
    }
    else {
      layer.setPackedVoxelAt(position, packed);
    }
  }

  #chunkOf(
    layer: VoxelLayer,
    cx: number,
    cy: number,
    cz: number
  ): TouchedChunk {
    const key = ((((cx + kChunkBias) * kChunkSpan) + cy + kChunkBias) *
      kChunkSpan) + cz + kChunkBias;
    if (
      this.#lastChunk !== null &&
      this.#lastLayer === layer &&
      this.#lastKey === key
    ) {
      return this.#lastChunk;
    }

    let chunks = this.#layers.get(layer);
    if (chunks === undefined) {
      chunks = new Map();
      this.#layers.set(layer, chunks);
    }

    let touched = chunks.get(key);
    if (touched === undefined) {
      touched = {
        cx,
        cy,
        cz,
        faces: 0,
        cells: null
      };
      chunks.set(key, touched);
    }

    this.#lastLayer = layer;
    this.#lastKey = key;
    this.#lastChunk = touched;

    return touched;
  }

  * #dirtyBoxes(
    layer: VoxelLayer,
    touched: TouchedChunk
  ): IterableIterator<WorldBox> {
    const size = this.#size;
    const minX = layer.position.x + (touched.cx * size);
    const minY = layer.position.y + (touched.cy * size);
    const minZ = layer.position.z + (touched.cz * size);
    const chunk: WorldBox = {
      minX,
      minY,
      minZ,
      maxX: minX + size - 1,
      maxY: minY + size - 1,
      maxZ: minZ + size - 1
    };
    yield chunk;

    const { faces } = touched;
    if (faces & kFaceMinX) {
      yield { ...chunk, minX: chunk.minX - 1, maxX: chunk.minX - 1 };
    }
    if (faces & kFaceMaxX) {
      yield { ...chunk, minX: chunk.maxX + 1, maxX: chunk.maxX + 1 };
    }
    if (faces & kFaceMinY) {
      yield { ...chunk, minY: chunk.minY - 1, maxY: chunk.minY - 1 };
    }
    if (faces & kFaceMaxY) {
      yield { ...chunk, minY: chunk.maxY + 1, maxY: chunk.maxY + 1 };
    }
    if (faces & kFaceMinZ) {
      yield { ...chunk, minZ: chunk.minZ - 1, maxZ: chunk.minZ - 1 };
    }
    if (faces & kFaceMaxZ) {
      yield { ...chunk, minZ: chunk.maxZ + 1, maxZ: chunk.maxZ + 1 };
    }
  }

  #markBox(
    layer: VoxelLayer,
    box: WorldBox
  ): void {
    const shift = this.#shift;
    const { x, y, z } = layer.position;

    const maxCx = (box.maxX - x) >> shift;
    const maxCy = (box.maxY - y) >> shift;
    const maxCz = (box.maxZ - z) >> shift;
    for (let cx = (box.minX - x) >> shift; cx <= maxCx; cx++) {
      for (let cy = (box.minY - y) >> shift; cy <= maxCy; cy++) {
        for (let cz = (box.minZ - z) >> shift; cz <= maxCz; cz++) {
          layer.markChunkDirty(cx, cy, cz);
        }
      }
    }
  }
}
