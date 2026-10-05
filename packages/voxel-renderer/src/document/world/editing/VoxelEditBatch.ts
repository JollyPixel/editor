// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { VoxelLayer } from "../VoxelLayer.ts";
import {
  VOXEL_ABSENT,
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "../storage/packedVoxel.ts";
import { sameCell } from "../storage/mergedVoxel.ts";
import type { VoxelCellChange } from "../types.ts";
import { TrackedCells } from "./TrackedCells.ts";
import {
  VOXEL_PATCH_STRIDE,
  type VoxelPatchCells,
  type VoxelPatchPartners
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
  partners: VoxelPatchPartners;
  changes: VoxelCellChange[];
  observed: VoxelCellChange[];
}

export const VOXEL_REACH_RECORDERS = 1;
export const VOXEL_REACH_OBSERVERS = 2;

interface WorldBox {
  min: Vector3Like;
  max: Vector3Like;
}

export interface VoxelEditWriteOptions {
  /**
   * Keep the cell so it can be emitted and recorded when the batch flushes.
   */
  track: boolean;
  /**
   * Recorders the cell reaches when the batch flushes: a mask of
   * `VOXEL_REACH_RECORDERS` and `VOXEL_REACH_OBSERVERS`.
   */
  reach: number;
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
    partner: PackedVoxel,
    options: VoxelEditWriteOptions
  ): void {
    const x = position.x - layer.position.x;
    const y = position.y - layer.position.y;
    const z = position.z - layer.position.z;
    const touched = this.#touch(layer, x, y, z);
    if (!options.track) {
      layer.setPackedVoxelAt(position, packed, partner);

      return;
    }

    const size = this.#size;
    const lx = x & this.#mask;
    const ly = y & this.#mask;
    const lz = z & this.#mask;
    const cells = this.#trackedCells(layer, touched);
    const index = lx + (size * (ly + (size * lz)));
    let entry = cells.entryOf(index);
    if (entry < 0) {
      const chunk = layer.getChunk(touched.cx, touched.cy, touched.cz);
      entry = cells.track(
        index,
        chunk === undefined ? VOXEL_ABSENT : chunk.getPackedAt(lx, ly, lz),
        chunk === undefined ? VOXEL_ABSENT : chunk.getPartnerAt(lx, ly, lz),
        options.reach
      );
      this.#pendingCells++;
    }
    cells.write(entry, packed, partner);
    layer.setPackedVoxelAt(position, packed, partner);
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

  * drain(): IterableIterator<VoxelEditBatchFlush> {
    if (this.#pendingCells === 0) {
      return;
    }
    this.#pendingCells = 0;

    for (const [layer, chunks] of this.#layers) {
      let pending = 0;
      for (const touched of chunks.values()) {
        pending += touched.cells?.size ?? 0;
      }
      if (pending === 0) {
        continue;
      }

      const flush: VoxelEditBatchFlush = {
        layer,
        cells: new Array(pending * VOXEL_PATCH_STRIDE),
        partners: [],
        changes: [],
        observed: []
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

  markDirty(
    layers: readonly VoxelLayer[]
  ): void {
    for (const [edited, chunks] of this.#layers) {
      if (!layers.includes(edited)) {
        continue;
      }

      for (const touched of chunks.values()) {
        const { min, max } = this.#dirtyBox(edited, touched);
        for (const layer of layers) {
          layer.markBoxDirty(min, max);
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
    const { originX, originY, originZ } = tracked;
    const { cells, partners } = flush;
    let written = offset;

    // eslint-disable-next-line max-params
    tracked.drain((index, from, to, fromPartner, toPartner, reach) => {
      if (sameCell(from, fromPartner, to, toPartner)) {
        return;
      }

      const x = originX + (index & mask);
      const y = originY + ((index >> shift) & mask);
      const z = originZ + (index >> (shift * 2));
      const absent = to === VOXEL_ABSENT;
      cells[written] = x;
      cells[written + 1] = y;
      cells[written + 2] = z;
      cells[written + 3] = absent ? 0 : voxelBlockId(to);
      cells[written + 4] = absent ? 0 : voxelTransform(to);
      if (toPartner !== VOXEL_ABSENT) {
        partners.push(
          written / VOXEL_PATCH_STRIDE,
          voxelBlockId(toPartner),
          voxelTransform(toPartner)
        );
      }
      written += VOXEL_PATCH_STRIDE;
      if (reach !== 0) {
        const change: VoxelCellChange = {
          layerId: flush.layer.id,
          position: { x, y, z },
          before: from,
          after: to,
          beforePartner: fromPartner,
          afterPartner: toPartner
        };
        if ((reach & VOXEL_REACH_RECORDERS) !== 0) {
          flush.changes.push(change);
        }
        if ((reach & VOXEL_REACH_OBSERVERS) !== 0) {
          flush.observed.push(change);
        }
      }
    });

    return written;
  }

  #trackedCells(
    layer: VoxelLayer,
    touched: TouchedChunk
  ): TrackedCells {
    touched.cells ??= new TrackedCells();

    const { cells } = touched;
    if (cells.size === 0) {
      cells.originX = layer.position.x + (touched.cx * this.#size);
      cells.originY = layer.position.y + (touched.cy * this.#size);
      cells.originZ = layer.position.z + (touched.cz * this.#size);
    }

    return cells;
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

  #dirtyBox(
    layer: VoxelLayer,
    touched: TouchedChunk
  ): WorldBox {
    const size = this.#size;
    const { faces } = touched;
    const minX = layer.position.x + (touched.cx * size);
    const minY = layer.position.y + (touched.cy * size);
    const minZ = layer.position.z + (touched.cz * size);

    return {
      min: {
        x: faces & kFaceMinX ? minX - 1 : minX,
        y: faces & kFaceMinY ? minY - 1 : minY,
        z: faces & kFaceMinZ ? minZ - 1 : minZ
      },
      max: {
        x: minX + size - (faces & kFaceMaxX ? 0 : 1),
        y: minY + size - (faces & kFaceMaxY ? 0 : 1),
        z: minZ + size - (faces & kFaceMaxZ ? 0 : 1)
      }
    };
  }
}
