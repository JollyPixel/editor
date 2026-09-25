// Import Internal Dependencies
import type { VoxelChunk } from "../../world/VoxelChunk.ts";
import type {
  BlockVariant,
  BlockVariantFace
} from "../variants/types.ts";
import type { BlockVariantCache } from "../variants/BlockVariantCache.ts";
import type { ChunkNeighbourhood } from "../neighbourhood/ChunkNeighbourhood.ts";
import type {
  Mesher,
  MeshPassOptions
} from "../types.ts";
import {
  voxelBlockId,
  voxelTransform
} from "../../world/packedVoxel.ts";
import { FACE_OFFSETS } from "../../utils/math.ts";
import { AO_UNOCCLUDED } from "../ambientOcclusion.ts";
import { FaceEmitter } from "./FaceEmitter.ts";

// CONSTANTS
const kDirections = 6;
const kNotMergeable = -1;
const kInitialLocalVariants = 16;
// Mask cells pack `(mergeId + 1) << kAoBits | ao` so only equal AO merges.
const kAoBits = 8;
const kAoMask = 0xFF;

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
  slice: number,
  u: number
): void {
  if (u < min[slice]) {
    min[slice] = u;
  }
  if (u > max[slice]) {
    max[slice] = u;
  }
}

function lowestBitIndex(
  bits: number
): number {
  return 31 - Math.clz32(bits & -bits);
}

/**
 * Merges identical full boundary quads using six dense-grid sweeps.
 */
export class GreedyMesher implements Mesher {
  #variants: BlockVariantCache;

  #grid = new Int32Array(0);
  #mask = new Int32Array(0);
  #size = -1;
  #words = 0;

  /**
   * Chunk variants compacted to indices for direct grid lookup.
   */
  #localVariants: BlockVariant[] = [];
  /**
   * Mergeable-direction mask for each local variant.
   */
  #mergeableDirections = new Uint8Array(kInitialLocalVariants);
  #epoch = 0;

  #rows = new Uint32Array(0);
  #visible = new Uint32Array(0);

  // Per-chunk state, set by `mesh()` so the passes stay parameter-free.
  #pass!: MeshPassOptions;
  #faces!: FaceEmitter;
  #chunk!: VoxelChunk;
  #neighbourhood!: ChunkNeighbourhood;
  #originX = 0;
  #originY = 0;
  #originZ = 0;

  #min = [0, 0, 0];
  #max = [-1, -1, -1];

  /**
   * Per-slice extents that avoid sweeping empty parts of terrain bounds.
   */
  #sliceMin: Int32Array[] = [];
  #sliceMax: Int32Array[] = [];

  #uMin = 0;
  #uMax = -1;

  /*
   * The three world axes of the direction being swept: the one the slices are
   * perpendicular to, plus the two in-plane axes the mask is indexed by. All
   * derived from the direction, so `#sweep()` sets them once per pass rather
   * than threading them through every slice.
   */
  #axis = 0;
  #uAxis = 0;
  #vAxis = 0;

  constructor(
    variants: BlockVariantCache
  ) {
    this.#variants = variants;
  }

  mesh(
    pass: MeshPassOptions
  ): void {
    const { chunk } = pass;

    this.#pass = pass;
    this.#faces = new FaceEmitter(pass);
    this.#chunk = chunk;
    this.#neighbourhood = pass.neighbourhood;
    this.#originX = pass.worldOriginX;
    this.#originY = pass.worldOriginY;
    this.#originZ = pass.worldOriginZ;

    this.#resize(chunk.size);
    this.#localVariants.length = 0;
    this.#epoch++;

    if (this.#fillGrid()) {
      for (let direction = 0; direction < kDirections; direction++) {
        this.#sweep(direction);
      }
    }
    this.#clearGrid();
  }

  #resize(
    size: number
  ): void {
    if (size === this.#size) {
      return;
    }

    const words = (size + 31) >> 5;
    this.#size = size;
    this.#words = words;
    this.#grid = new Int32Array(size * size * size);
    this.#mask = new Int32Array(size * size);
    this.#rows = new Uint32Array(kDirections * size * size * words);
    this.#visible = new Uint32Array(size * words);
    this.#sliceMin = [
      new Int32Array(size),
      new Int32Array(size),
      new Int32Array(size)
    ];
    this.#sliceMax = [
      new Int32Array(size),
      new Int32Array(size),
      new Int32Array(size)
    ];
  }

  #rowIndex(
    direction: number,
    slice: number,
    u: number
  ): number {
    const size = this.#size;

    return (((direction * size) + slice) * size + u) * this.#words;
  }

  #rowBitOf(
    direction: number,
    lx: number,
    ly: number,
    lz: number
  ): number {
    const axis = direction >> 1;
    let slice = lz;
    let u = lx;
    let v = ly;
    if (axis === 0) {
      slice = lx;
      u = ly;
      v = lz;
    }
    else if (axis === 1) {
      slice = ly;
      v = lz;
    }

    return ((this.#rowIndex(direction, slice, u) + (v >> 5)) << 5) | (v & 31);
  }

  #fillGrid(): boolean {
    const { size, shift, mask } = this.#chunk;
    const shiftZ = shift * 2;
    const stats = this.#pass.stats;
    const rows = this.#rows;
    const min = [size, size, size];
    const max = [-1, -1, -1];
    const { keys, values, capacity } = this.#chunk.store;
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

      const directions = this.#mergeableDirections[local];
      for (let direction = 0; direction < kDirections; direction++) {
        if ((directions & (1 << direction)) === 0) {
          continue;
        }

        const bit = this.#rowBitOf(direction, lx, ly, lz);
        rows[bit >> 5] |= 1 << (bit & 31);
      }

      widenSlice(sliceMinX, sliceMaxX, lx, ly);
      widenSlice(sliceMinY, sliceMaxY, ly, lx);
      widenSlice(sliceMinZ, sliceMaxZ, lz, lx);

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
    for (const face of variant.faces) {
      if (face.merge === null) {
        this.#faces.emitVisible(variant, face, wx, wy, wz);
      }
    }
  }

  #aoAt(
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number
  ): number {
    return this.#pass.ambientOcclusion ?
      this.#neighbourhood.ambientOcclusionAt(face.cull, wx, wy, wz) :
      AO_UNOCCLUDED;
  }

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
      const uMin = sliceMin[slice];
      const uMax = sliceMax[slice];
      if (uMax < uMin) {
        continue;
      }

      this.#uMin = uMin;
      this.#uMax = uMax;

      if (this.#buildMask(direction, slice)) {
        this.#mergeMask(slice);
      }
    }
  }

  #buildMask(
    direction: number,
    slice: number
  ): boolean {
    const size = this.#size;
    const words = this.#words;
    const mask = this.#mask;
    const grid = this.#grid;
    const rows = this.#rows;
    const visible = this.#visible;
    const stats = this.#pass.stats;
    const neighbourhood = this.#neighbourhood;
    const localVariants = this.#localVariants;
    const offset = FACE_OFFSETS[direction];
    const axis = this.#axis;
    const uAxis = this.#uAxis;
    const vAxis = this.#vAxis;
    const strideU = strideOf(uAxis, size);
    const strideV = strideOf(vAxis, size);
    const sliceBase = slice * strideOf(axis, size);
    const sliceX = this.#originX + offset[0] + (axis === 0 ? slice : 0);
    const sliceY = this.#originY + offset[1] + (axis === 1 ? slice : 0);
    const sliceZ = this.#originZ + offset[2] + (axis === 2 ? slice : 0);
    const uX = uAxis === 0 ? 1 : 0;
    const uY = uAxis === 1 ? 1 : 0;
    const vY = vAxis === 1 ? 1 : 0;
    const vZ = vAxis === 2 ? 1 : 0;
    let found = false;

    for (let u = this.#uMin; u <= this.#uMax; u++) {
      const rowBase = this.#rowIndex(direction, slice, u);
      const gridRow = sliceBase + (u * strideU);
      const maskRow = u * size;
      const visibleRow = u * words;
      const nx = sliceX + (u * uX);
      const ny = sliceY + (u * uY);

      for (let word = 0; word < words; word++) {
        let bits = rows[rowBase + word];
        let visibleBits = 0;

        while (bits !== 0) {
          const bit = bits & -bits;
          bits ^= bit;
          const v = (word << 5) + (31 - Math.clz32(bit));
          const variant = localVariants[grid[gridRow + (v * strideV)] - 1];
          const cellY = ny + (v * vY);
          const cellZ = sliceZ + (v * vZ);
          const face = variant.mergeFaces[direction]!;

          if (
            neighbourhood.isNeighbourFaceHidden(
              nx,
              cellY,
              cellZ,
              variant,
              face
            )
          ) {
            stats.culledFaces++;
            continue;
          }

          if (face.splittable && !neighbourhood.isVacantAt(nx, cellY, cellZ)) {
            this.#faces.emit(
              variant,
              face,
              nx - offset[0],
              cellY - offset[1],
              cellZ - offset[2]
            );
            continue;
          }

          mask[maskRow + v] = ((face.mergeId + 1) << kAoBits) | this.#aoAt(
            face,
            nx - offset[0],
            cellY - offset[1],
            cellZ - offset[2]
          );
          visibleBits |= bit;
        }

        visible[visibleRow + word] = visibleBits;
        if (visibleBits !== 0) {
          found = true;
        }
      }
    }

    return found;
  }

  #mergeMask(
    slice: number
  ): void {
    const axis = this.#axis;
    const size = this.#size;
    const words = this.#words;
    const mask = this.#mask;
    const visible = this.#visible;
    const { stats, bufferFor } = this.#pass;
    const uMax = this.#uMax;

    for (let u = this.#uMin; u <= uMax; u++) {
      const rowBase = u * size;
      const visibleRow = u * words;

      for (let word = 0; word < words; word++) {
        while (visible[visibleRow + word] !== 0) {
          const v = (word << 5) + lowestBitIndex(visible[visibleRow + word]);
          const cell = mask[rowBase + v];

          let spanV = 1;
          while (v + spanV < size && mask[rowBase + v + spanV] === cell) {
            spanV++;
          }

          let spanU = 1;
          while (
            u + spanU <= uMax &&
            this.#rowMatches(rowBase + (spanU * size) + v, spanV, cell)
          ) {
            spanU++;
          }

          this.#consume(u, v, spanU, spanV);

          const lx = axis === 0 ? slice : u;
          const lz = axis === 2 ? slice : v;
          let ly = v;
          if (axis === 0) {
            ly = u;
          }
          else if (axis === 1) {
            ly = slice;
          }
          const face = this.#variants.mergeFaceOf((cell >> kAoBits) - 1);

          bufferFor(face.slot).addMergedFace(
            face,
            this.#originX + lx,
            this.#originY + ly,
            this.#originZ + lz,
            spanU,
            spanV,
            cell & kAoMask
          );
          stats.faces++;
          stats.mergedFaces += (spanU * spanV) - 1;
        }
      }
    }
  }

  #consume(
    u: number,
    v: number,
    spanU: number,
    spanV: number
  ): void {
    const size = this.#size;
    const words = this.#words;
    const mask = this.#mask;
    const visible = this.#visible;

    for (let a = u; a < u + spanU; a++) {
      const row = a * size;
      const bitsRow = a * words;
      for (let b = v; b < v + spanV; b++) {
        mask[row + b] = 0;
        visible[bitsRow + (b >> 5)] &= ~(1 << (b & 31));
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

  #clearGrid(): void {
    const grid = this.#grid;
    const rows = this.#rows;
    const { shift, mask } = this.#chunk;
    const shiftZ = shift * 2;
    const { keys, capacity } = this.#chunk.store;

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0 || grid[linearIdx] === 0) {
        continue;
      }
      grid[linearIdx] = 0;

      const lx = linearIdx & mask;
      const ly = (linearIdx >> shift) & mask;
      const lz = linearIdx >> shiftZ;
      for (let direction = 0; direction < kDirections; direction++) {
        rows[this.#rowBitOf(direction, lx, ly, lz) >> 5] = 0;
      }
    }
  }
}
