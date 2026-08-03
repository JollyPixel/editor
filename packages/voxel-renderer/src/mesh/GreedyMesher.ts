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
/** Marks a variant that owns no mergeable face, so the sweep can skip it. */
const kNotMergeable = -1;
const kInitialLocalVariants = 16;

export type GeometryBufferFactory = (slot: number) => GeometryBuffer;

/** Step between two cells of the dense grid along one world axis. */
function strideOf(
  axis: number,
  size: number
): number {
  if (axis === 0) {
    return 1;
  }

  return axis === 1 ? size : size * size;
}

/** Grows one slice's `(u, v)` extents to contain a newly written cell. */
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

/** Options shared by both mesh passes, naive and greedy. */
export interface MeshPassOptions {
  chunk: VoxelChunk;
  /** Prefetched layers around the chunk, and the occlusion queries over them. */
  neighbourhood: ChunkNeighbourhood;
  worldOriginX: number;
  worldOriginY: number;
  worldOriginZ: number;
  stats: MeshBuildStats;
  bufferFor: GeometryBufferFactory;
}

/**
 * Meshes one chunk by merging coplanar identical faces into the largest quads
 * it can, instead of emitting one quad per voxel face.
 *
 * A face takes part only when `BlockVariantCache` marked it mergeable — a full
 * unit quad flat on the block boundary. Slopes, stair risers and other partial
 * faces are emitted per voxel exactly as the naive path does, so a chunk mixing
 * cubes and ramps still meshes correctly; only the cube-like faces merge.
 *
 * Two voxels merge when they resolve to the same (block, transform) variant and
 * both show the same world-space direction, which by construction gives them
 * the same texture, normal, winding and tileset. Nothing else is compared: this
 * renderer carries no per-vertex lighting or ambient occlusion that a stretched
 * quad could smear.
 *
 * Merging never crosses a chunk boundary, which is what keeps a chunk rebuild
 * local.
 *
 * The sweep needs random access, unlike the naive path which walks the chunk's
 * sparse map. Voxels are therefore scattered into a dense grid once — O(voxels)
 * — and the six directional passes read that grid, restricted to the bounding
 * box of the filled cells so a mostly-empty chunk costs little.
 */
export class GreedyMesher {
  #variants: BlockVariantCache;

  /** Dense `size³` grid of local variant indices, offset by 1 (0 = empty). */
  #grid = new Int32Array(0);
  /** One `size²` slice of the grid being merged. */
  #mask = new Int32Array(0);
  #size = -1;

  /**
   * Variants present in the chunk, compacted to small indices so the sweep can
   * resolve a cell with an array read instead of a hash lookup.
   */
  #localVariants: BlockVariant[] = [];
  /**
   * Bit `d` set when the local variant at that index owns a mergeable face in
   * direction `d`. Lifts the per-cell `mergeFaces[direction]` probe out of the
   * mask-building loop.
   */
  #mergeableDirections = new Uint8Array(kInitialLocalVariants);
  /** Bumped per chunk; stamps `BlockVariant.sweepEpoch` in place of a Map. */
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
   * Per-slice in-plane extents, one pair of arrays per world axis, each holding
   * `(u, v)` per slice. The chunk's whole bounding box is a poor proxy for one
   * slice of it — a terrain chunk is nearly empty in most of its box — so the
   * sweep reads these instead. Filled by `#fillGrid()`, which already visits
   * every voxel.
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

  /**
   * Writes the chunk's geometry into the buffers `bufferFor` hands out.
   * Returns true when at least one face was emitted.
   */
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
   * Scatters the chunk's voxels into the dense grid, emitting the faces the
   * sweep cannot handle on the way. Returns false when nothing is mergeable,
   * which lets `mesh()` skip all six passes.
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

  /**
   * Emits the faces of one voxel that no directional pass will pick up:
   * triangles, slopes and any face not flat on the block boundary.
   */
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
   * Compact index for a variant, or `kNotMergeable` when it owns no face the
   * sweep can stretch (a stair, for instance).
   *
   * `BlockVariantCache` memoizes one object per (block, transform), so the
   * answer is stamped onto the variant under the current epoch rather than kept
   * in a side map keyed by it.
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

  /**
   * Builds and merges every slice perpendicular to one of the six directions.
   */
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
   * Fills the mask with the local variant index of every voxel in the slice
   * showing a visible mergeable face in `direction`, and 0 everywhere else.
   * Returns false when the slice has no such face.
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
          // X and Z are a single comparison each; only Y depends on all three axes.
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
   * Consumes the mask, emitting one quad per maximal rectangle of equal cells.
   * Rectangles grow along `vAxis` first (contiguous in the mask) and then along
   * `uAxis`, the usual greedy order.
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
        // X and Z are a single comparison each; only Y depends on all three axes.
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

  /**
   * True when the `spanV` mask cells from `start` onward all hold `cell` — the
   * test that lets a rectangle grow one row.
   */
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
   * Zeroes only the cells `#fillGrid()` wrote, so the next chunk starts clean
   * without paying for a full `size³` clear.
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
