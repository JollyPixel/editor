// Import Internal Dependencies
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { BlockVariant, BlockVariantCache } from "./BlockVariantCache.ts";
import type { GeometryBuffer } from "./GeometryBuffer.ts";
import type { MeshBuildStats } from "./MeshBuildStats.ts";
import type { LayerChunkCache } from "./ChunkNeighbourhood.ts";
import {
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "./math.ts";
import {
  isNeighbourFaceHidden,
  winsCompositing
} from "./occlusion.ts";

// CONSTANTS
const kDirections = 6;
/** Marks a variant that owns no mergeable face, so the sweep can skip it. */
const kNotMergeable = -1;

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

/**
 * The Y coordinate of the cell at `(slice, u, v)`. X and Z are a single
 * comparison each; only Y depends on all three axes.
 */
// eslint-disable-next-line max-params
function localY(
  axis: number,
  slice: number,
  u: number,
  v: number
): number {
  if (axis === 0) {
    return u;
  }

  return axis === 1 ? slice : v;
}

export interface GreedyMeshOptions {
  chunk: VoxelChunk;
  /** Every effectively visible layer, in compositing order. */
  layers: readonly LayerChunkCache[];
  /** Rank of the layer being meshed among `layers`, or -1 when it is hidden. */
  selfIndex: number;
  worldOriginX: number;
  worldOriginY: number;
  worldOriginZ: number;
  /** The owning layer's opacity as an 8-bit value. */
  alpha: number;
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
  #localIndices = new Map<BlockVariant, number>();

  // Per-chunk state, set by `mesh()` so the passes stay parameter-free.
  #chunk!: VoxelChunk;
  #layers: readonly LayerChunkCache[] = [];
  #layerCount = 0;
  #selfIndex = -1;
  #originX = 0;
  #originY = 0;
  #originZ = 0;
  #alpha = 255;
  #stats!: MeshBuildStats;
  #bufferFor!: GeometryBufferFactory;

  #min = [0, 0, 0];
  #max = [-1, -1, -1];
  #emitted = false;

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
    options: GreedyMeshOptions
  ): boolean {
    const { chunk } = options;

    this.#chunk = chunk;
    this.#layers = options.layers;
    this.#layerCount = options.layers.length;
    this.#selfIndex = options.selfIndex;
    this.#originX = options.worldOriginX;
    this.#originY = options.worldOriginY;
    this.#originZ = options.worldOriginZ;
    this.#alpha = options.alpha;
    this.#stats = options.stats;
    this.#bufferFor = options.bufferFor;
    this.#emitted = false;

    this.#resize(chunk.size);
    this.#localVariants.length = 0;
    this.#localIndices.clear();

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
  }

  /**
   * Scatters the chunk's voxels into the dense grid, emitting the faces the
   * sweep cannot handle on the way. Returns false when nothing is mergeable,
   * which lets `mesh()` skip all six passes.
   */
  #fillGrid(): boolean {
    const { size } = this.#chunk;
    const stats = this.#stats;
    const min = [size, size, size];
    const max = [-1, -1, -1];
    // A power-of-two chunk size turns the index decode into shifts and masks.
    const shift = (size & (size - 1)) === 0 ? Math.log2(size) : -1;
    const bits = size - 1;
    let filled = false;

    for (const [linearIdx, entry] of this.#chunk.entries()) {
      const lx = shift >= 0 ? linearIdx & bits : linearIdx % size;
      const ly = shift >= 0 ?
        (linearIdx >> shift) & bits :
        ((linearIdx / size) | 0) % size;
      const lz = shift >= 0 ?
        linearIdx >> (shift * 2) :
        (linearIdx / (size * size)) | 0;
      const wx = this.#originX + lx;
      const wy = this.#originY + ly;
      const wz = this.#originZ + lz;

      stats.voxels++;
      if (
        !winsCompositing(
          this.#layers, this.#layerCount, this.#selfIndex, entry, wx, wy, wz
        )
      ) {
        stats.hiddenVoxels++;
        continue;
      }

      const variant = this.#variants.get(entry.blockId, entry.transform);
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
  // eslint-disable-next-line max-params
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
        const hidden = isNeighbourFaceHidden(
          this.#variants,
          this.#layers,
          this.#layerCount,
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

      this.#bufferFor(face.slot).addFace(face, wx, wy, wz, this.#alpha);
      stats.faces++;
      this.#emitted = true;
    }
  }

  /**
   * Compact index for a variant, or `kNotMergeable` when it owns no face the
   * sweep can stretch (a stair, for instance).
   *
   * `BlockVariantCache` memoizes one object per (block, transform), so the
   * variant itself is the key — no need to re-derive how the cache packs one.
   */
  #localIndexOf(
    variant: BlockVariant
  ): number {
    let local = this.#localIndices.get(variant);
    if (local === undefined) {
      local = variant.mergeFaces.some((face) => face !== undefined) ?
        this.#localVariants.push(variant) - 1 :
        kNotMergeable;
      this.#localIndices.set(variant, local);
    }

    return local;
  }

  /**
   * Builds and merges every slice perpendicular to one of the six directions.
   */
  #sweep(
    direction: number
  ): void {
    const axis = direction >> 1;
    const uAxis = axis === 0 ? 1 : 0;
    const vAxis = axis === 2 ? 1 : 2;
    const last = this.#max[axis];

    for (let slice = this.#min[axis]; slice <= last; slice++) {
      if (this.#buildMask(direction, axis, uAxis, vAxis, slice)) {
        this.#mergeMask(direction, axis, uAxis, vAxis, slice);
      }
    }
  }

  /**
   * Fills the mask with the local variant index of every voxel in the slice
   * showing a visible mergeable face in `direction`, and 0 everywhere else.
   * Returns false when the slice has no such face.
   */
  // eslint-disable-next-line max-params
  #buildMask(
    direction: number,
    axis: number,
    uAxis: number,
    vAxis: number,
    slice: number
  ): boolean {
    const size = this.#size;
    const mask = this.#mask;
    const grid = this.#grid;
    const stats = this.#stats;
    const offset = FACE_OFFSETS[direction];
    const opposite = FACE_OPPOSITE[direction];
    // Walking the grid by stride keeps the (u, v) → linear index mapping out of
    // the inner loop, which runs over the whole bounding box on every slice.
    const strideU = strideOf(uAxis, size);
    const strideV = strideOf(vAxis, size);
    const sliceBase = slice * strideOf(axis, size);
    const uMin = this.#min[uAxis];
    const uMax = this.#max[uAxis];
    const vMin = this.#min[vAxis];
    const vMax = this.#max[vAxis];
    let found = false;

    for (let u = uMin; u <= uMax; u++) {
      const rowBase = sliceBase + (u * strideU);
      const maskRow = u * size;

      for (let v = vMin; v <= vMax; v++) {
        const cell = grid[rowBase + (v * strideV)];
        let value = 0;

        if (cell !== 0 && this.#localVariants[cell - 1].mergeFaces[direction] !== undefined) {
          const lx = axis === 0 ? slice : u;
          const ly = localY(axis, slice, u, v);
          const lz = axis === 2 ? slice : v;

          if (
            isNeighbourFaceHidden(
              this.#variants,
              this.#layers,
              this.#layerCount,
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
  // eslint-disable-next-line max-params
  #mergeMask(
    direction: number,
    axis: number,
    uAxis: number,
    vAxis: number,
    slice: number
  ): void {
    const size = this.#size;
    const mask = this.#mask;
    const stats = this.#stats;
    const uMin = this.#min[uAxis];
    const uMax = this.#max[uAxis];
    const vMin = this.#min[vAxis];
    const vMax = this.#max[vAxis];

    for (let u = uMin; u <= uMax; u++) {
      for (let v = vMin; v <= vMax;) {
        const cell = mask[(u * size) + v];
        if (cell === 0) {
          v++;
          continue;
        }

        let spanV = 1;
        while (v + spanV <= vMax && mask[(u * size) + v + spanV] === cell) {
          spanV++;
        }

        let spanU = 1;
        while (
          u + spanU <= uMax &&
          this.#rowMatches((u + spanU) * size, v, spanV, cell)
        ) {
          spanU++;
        }

        for (let a = 0; a < spanU; a++) {
          const row = (u + a) * size;
          for (let b = 0; b < spanV; b++) {
            mask[row + v + b] = 0;
          }
        }

        const lx = axis === 0 ? slice : u;
        const ly = localY(axis, slice, u, v);
        const lz = axis === 2 ? slice : v;
        const face = this.#localVariants[cell - 1].mergeFaces[direction]!;

        this.#bufferFor(face.slot).addMergedFace(
          face,
          this.#originX + lx,
          this.#originY + ly,
          this.#originZ + lz,
          this.#alpha,
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
   * True when `spanV` mask cells starting at `v` on the row beginning at
   * `rowBase` all hold `cell` — the test that lets a rectangle grow one row.
   */
  // eslint-disable-next-line max-params
  #rowMatches(
    rowBase: number,
    v: number,
    spanV: number,
    cell: number
  ): boolean {
    const mask = this.#mask;

    for (let k = 0; k < spanV; k++) {
      if (mask[rowBase + v + k] !== cell) {
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

    for (const [linearIdx] of this.#chunk.entries()) {
      grid[linearIdx] = 0;
    }
  }
}
