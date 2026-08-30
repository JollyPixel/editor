// Import Internal Dependencies
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { BlockVariant, BlockVariantCache } from "./BlockVariantCache.ts";
import type { GeometryBuffer } from "./GeometryBuffer.ts";
import type { MeshBuildStats } from "./MeshBuildStats.ts";
import type { ChunkNeighbourhood } from "./ChunkNeighbourhood.ts";
import {
  voxelBlockId,
  voxelTransform
} from "../world/packedVoxel.ts";
import {
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "../utils/math.ts";

// CONSTANTS
const kDirections = 6;
const kNotMergeable = -1;
const kInitialLocalVariants = 16;

export type GeometryBufferFactory = (slot: number) => GeometryBuffer;

function strideOf(
  axis: number,
  size: number
): number {
  if (axis === 0) {
    return 1;
  }

  return axis === 1 ? size : size * size;
}

function widenSlice(
  min: Int32Array,
  max: Int32Array,
  bound: number,
  u: number,
  v: number
): void {
  if (u < min[bound]) {
    min[bound] = u;
  }
  if (u > max[bound]) {
    max[bound] = u;
  }
  if (v < min[bound + 1]) {
    min[bound + 1] = v;
  }
  if (v > max[bound + 1]) {
    max[bound + 1] = v;
  }
}

export interface MeshPassOptions {
  chunk: VoxelChunk;
  neighbourhood: ChunkNeighbourhood;
  worldOriginX: number;
  worldOriginY: number;
  worldOriginZ: number;
  stats: MeshBuildStats;
  bufferFor: GeometryBufferFactory;
}

/**
 * Merges identical full boundary quads using six dense-grid sweeps.
 */
export class GreedyMesher {
  #variants: BlockVariantCache;

  #grid = new Int32Array(0);
  #mask = new Int32Array(0);
  #size = -1;

  /**
   * Chunk variants compacted to indices for direct grid lookup.
   */
  #localVariants: BlockVariant[] = [];
  /**
   * Mergeable-direction mask for each local variant.
   */
  #mergeableDirections = new Uint8Array(kInitialLocalVariants);
  #epoch = 0;

  // Per-chunk state, set by `mesh()` so the passes stay parameter-free.
  #chunk!: VoxelChunk;
  #neighbourhood!: ChunkNeighbourhood;
  #originX = 0;
  #originY = 0;
  #originZ = 0;
  #stats!: MeshBuildStats;
  #bufferFor!: GeometryBufferFactory;

  #min = [0, 0, 0];
  #max = [-1, -1, -1];
  #emitted = false;

  /**
   * Per-slice extents that avoid sweeping empty parts of terrain bounds.
   */
  #sliceMin: Int32Array[] = [];
  #sliceMax: Int32Array[] = [];

  // Extents of the slice being swept, set by `#sweep()` so the two passes over
  // it agree without recomputing them.
  #uMin = 0;
  #uMax = -1;
  #vMin = 0;
  #vMax = -1;

  // The three world axes of the direction being swept: the one the slices are
  // perpendicular to, plus the two in-plane axes the mask is indexed by. All
  // derived from the direction, so `#sweep()` sets them once per pass rather
  // than threading them through every slice.
  #axis = 0;
  #uAxis = 0;
  #vAxis = 0;

  constructor(
    variants: BlockVariantCache
  ) {
    this.#variants = variants;
  }

  mesh(
    options: MeshPassOptions
  ): boolean {
    const { chunk } = options;

    this.#chunk = chunk;
    this.#neighbourhood = options.neighbourhood;
    this.#originX = options.worldOriginX;
    this.#originY = options.worldOriginY;
    this.#originZ = options.worldOriginZ;
    this.#stats = options.stats;
    this.#bufferFor = options.bufferFor;
    this.#emitted = false;

    this.#resize(chunk.size);
    this.#localVariants.length = 0;
    this.#epoch++;

    if (this.#fillGrid()) {
      for (let direction = 0; direction < kDirections; direction++) {
        this.#sweep(direction);
      }
    }
    this.#clearGrid();

    return this.#emitted;
  }

  #resize(
    size: number
  ): void {
    if (size === this.#size) {
      return;
    }

    this.#size = size;
    this.#grid = new Int32Array(size * size * size);
    this.#mask = new Int32Array(size * size);
    this.#sliceMin = [
      new Int32Array(size * 2),
      new Int32Array(size * 2),
      new Int32Array(size * 2)
    ];
    this.#sliceMax = [
      new Int32Array(size * 2),
      new Int32Array(size * 2),
      new Int32Array(size * 2)
    ];
  }

  /**
   * Fills the grid and emits faces that no directional sweep can merge.
   */
  #fillGrid(): boolean {
    const { size, shift, mask } = this.#chunk;
    const shiftZ = shift * 2;
    const stats = this.#stats;
    const min = [size, size, size];
    const max = [-1, -1, -1];
    const { keys, values, capacity } = this.#chunk.store;
    // Inverted ranges: a slice nothing writes to stays "empty" and is skipped.
    const sliceMinX = this.#sliceMin[0].fill(size);
    const sliceMaxX = this.#sliceMax[0].fill(-1);
    const sliceMinY = this.#sliceMin[1].fill(size);
    const sliceMaxY = this.#sliceMax[1].fill(-1);
    const sliceMinZ = this.#sliceMin[2].fill(size);
    const sliceMaxZ = this.#sliceMax[2].fill(-1);
    let filled = false;

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0) {
        continue;
      }

      const lx = linearIdx & mask;
      const ly = (linearIdx >> shift) & mask;
      const lz = linearIdx >> shiftZ;
      const wx = this.#originX + lx;
      const wy = this.#originY + ly;
      const wz = this.#originZ + lz;

      stats.voxels++;
      if (!this.#neighbourhood.winsCompositing(wx, wy, wz)) {
        stats.hiddenVoxels++;
        continue;
      }

      const packed = values[slot];
      const variant = this.#variants.get(
        voxelBlockId(packed),
        voxelTransform(packed)
      );
      if (variant === null) {
        continue;
      }

      this.#emitUnmergeableFaces(variant, wx, wy, wz);

      const local = this.#localIndexOf(variant);
      if (local === kNotMergeable) {
        continue;
      }

      this.#grid[linearIdx] = local + 1;
      filled = true;

      // Slices perpendicular to X are indexed by lx and spanned by (ly, lz);
      // the other two axes follow the same (uAxis, vAxis) order `#sweep()` uses.
      widenSlice(sliceMinX, sliceMaxX, lx * 2, ly, lz);
      widenSlice(sliceMinY, sliceMaxY, ly * 2, lx, lz);
      widenSlice(sliceMinZ, sliceMaxZ, lz * 2, lx, ly);

      if (lx < min[0]) {
        min[0] = lx;
      }
      if (lx > max[0]) {
        max[0] = lx;
      }
      if (ly < min[1]) {
        min[1] = ly;
      }
      if (ly > max[1]) {
        max[1] = ly;
      }
      if (lz < min[2]) {
        min[2] = lz;
      }
      if (lz > max[2]) {
        max[2] = lz;
      }
    }

    this.#min = min;
    this.#max = max;

    return filled;
  }

  #emitUnmergeableFaces(
    variant: BlockVariant,
    wx: number,
    wy: number,
    wz: number
  ): void {
    const stats = this.#stats;

    for (const face of variant.faces) {
      if (face.merge !== null) {
        continue;
      }

      const { cull } = face;
      if (cull >= 0) {
        const offset = FACE_OFFSETS[cull];
        const hidden = this.#neighbourhood.isNeighbourFaceHidden(
          wx + offset[0],
          wy + offset[1],
          wz + offset[2],
          FACE_OPPOSITE[cull]
        );
        if (hidden) {
          stats.culledFaces++;
          continue;
        }
      }

      this.#bufferFor(face.slot).addFace(face, wx, wy, wz);
      stats.faces++;
      this.#emitted = true;
    }
  }

  /**
   * Returns an epoch-stamped local index, or `kNotMergeable`.
   */
  #localIndexOf(
    variant: BlockVariant
  ): number {
    if (variant.sweepEpoch === this.#epoch) {
      return variant.sweepIndex;
    }
    variant.sweepEpoch = this.#epoch;

    const { mergeFaces } = variant;
    let directions = 0;
    for (let direction = 0; direction < kDirections; direction++) {
      if (mergeFaces[direction] !== undefined) {
        directions |= 1 << direction;
      }
    }

    if (directions === 0) {
      variant.sweepIndex = kNotMergeable;

      return kNotMergeable;
    }

    const local = this.#localVariants.push(variant) - 1;
    if (local >= this.#mergeableDirections.length) {
      const grown = new Uint8Array(this.#mergeableDirections.length * 2);
      grown.set(this.#mergeableDirections);
      this.#mergeableDirections = grown;
    }
    this.#mergeableDirections[local] = directions;
    variant.sweepIndex = local;

    return local;
  }

  #sweep(
    direction: number
  ): void {
    const axis = direction >> 1;
    this.#axis = axis;
    this.#uAxis = axis === 0 ? 1 : 0;
    this.#vAxis = axis === 2 ? 1 : 2;

    const sliceMin = this.#sliceMin[axis];
    const sliceMax = this.#sliceMax[axis];
    const last = this.#max[axis];

    for (let slice = this.#min[axis]; slice <= last; slice++) {
      const bound = slice * 2;
      const uMin = sliceMin[bound];
      const uMax = sliceMax[bound];
      if (uMax < uMin) {
        continue;
      }

      this.#uMin = uMin;
      this.#uMax = uMax;
      this.#vMin = sliceMin[bound + 1];
      this.#vMax = sliceMax[bound + 1];

      if (this.#buildMask(direction, slice)) {
        this.#mergeMask(direction, slice);
      }
    }
  }

  /**
   * Builds one directional slice mask and reports whether it contains a face.
   */
  #buildMask(
    direction: number,
    slice: number
  ): boolean {
    const axis = this.#axis;
    const uAxis = this.#uAxis;
    const vAxis = this.#vAxis;
    const size = this.#size;
    const mask = this.#mask;
    const grid = this.#grid;
    const stats = this.#stats;
    const mergeable = this.#mergeableDirections;
    const directionBit = 1 << direction;
    const offset = FACE_OFFSETS[direction];
    const opposite = FACE_OPPOSITE[direction];
    // Walking the grid by stride keeps the (u, v) → linear index mapping out of
    // the inner loop, which runs over the whole bounding box on every slice.
    const strideU = strideOf(uAxis, size);
    const strideV = strideOf(vAxis, size);
    const sliceBase = slice * strideOf(axis, size);
    const uMin = this.#uMin;
    const uMax = this.#uMax;
    const vMin = this.#vMin;
    const vMax = this.#vMax;
    let found = false;

    for (let u = uMin; u <= uMax; u++) {
      const rowBase = sliceBase + (u * strideU);
      const maskRow = u * size;

      for (let v = vMin; v <= vMax; v++) {
        const cell = grid[rowBase + (v * strideV)];
        let value = 0;

        if (cell !== 0 && (mergeable[cell - 1] & directionBit) !== 0) {
          const lx = axis === 0 ? slice : u;
          const lz = axis === 2 ? slice : v;
          let ly = v;
          if (axis === 0) {
            ly = u;
          }
          else if (axis === 1) {
            ly = slice;
          }

          if (
            this.#neighbourhood.isNeighbourFaceHidden(
              this.#originX + lx + offset[0],
              this.#originY + ly + offset[1],
              this.#originZ + lz + offset[2],
              opposite
            )
          ) {
            stats.culledFaces++;
          }
          else {
            value = cell;
            found = true;
          }
        }

        mask[maskRow + v] = value;
      }
    }

    return found;
  }

  /**
   * Emits one quad per maximal equal-cell rectangle in the mask.
   */
  #mergeMask(
    direction: number,
    slice: number
  ): void {
    const axis = this.#axis;
    const size = this.#size;
    const mask = this.#mask;
    const stats = this.#stats;
    const uMin = this.#uMin;
    const uMax = this.#uMax;
    const vMin = this.#vMin;
    const vMax = this.#vMax;

    for (let u = uMin; u <= uMax; u++) {
      const rowBase = u * size;

      for (let v = vMin; v <= vMax;) {
        const cell = mask[rowBase + v];
        if (cell === 0) {
          v++;
          continue;
        }

        let spanV = 1;
        while (v + spanV <= vMax && mask[rowBase + v + spanV] === cell) {
          spanV++;
        }

        let spanU = 1;
        while (
          u + spanU <= uMax &&
          this.#rowMatches(rowBase + (spanU * size) + v, spanV, cell)
        ) {
          spanU++;
        }

        for (let a = 0, row = rowBase; a < spanU; a++, row += size) {
          for (let b = 0; b < spanV; b++) {
            mask[row + v + b] = 0;
          }
        }

        const lx = axis === 0 ? slice : u;
        const lz = axis === 2 ? slice : v;
        let ly = v;
        if (axis === 0) {
          ly = u;
        }
        else if (axis === 1) {
          ly = slice;
        }
        const face = this.#localVariants[cell - 1].mergeFaces[direction]!;

        this.#bufferFor(face.slot).addMergedFace(
          face,
          this.#originX + lx,
          this.#originY + ly,
          this.#originZ + lz,
          spanU,
          spanV
        );
        stats.faces++;
        stats.mergedFaces += (spanU * spanV) - 1;
        this.#emitted = true;

        v += spanV;
      }
    }
  }

  #rowMatches(
    start: number,
    spanV: number,
    cell: number
  ): boolean {
    const mask = this.#mask;

    for (let k = 0; k < spanV; k++) {
      if (mask[start + k] !== cell) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clears only populated grid cells.
   */
  #clearGrid(): void {
    const grid = this.#grid;
    const { keys, capacity } = this.#chunk.store;

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx >= 0) {
        grid[linearIdx] = 0;
      }
    }
  }
}
