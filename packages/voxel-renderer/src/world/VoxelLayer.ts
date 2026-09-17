// Import Third-party Dependencies
import {
  Box3,
  Vector3,
  type Vector3Like
} from "three";

// Import Internal Dependencies
import { assertPowerOfTwoChunkSize, clamp } from "../utils/math.ts";
import { VoxelChunk } from "./VoxelChunk.ts";
import {
  packVoxel,
  unpackVoxel,
  voxelBlockId,
  voxelTransform,
  VOXEL_ABSENT,
  type PackedVoxel
} from "./packedVoxel.ts";
import type {
  VoxelEntry,
  VoxelCoord
} from "./types.ts";

/*
 * CONSTANTS
 * Chunk coordinates are packed into a single int32 so the chunk map keeps
 * Smi keys: 11 bits for X and Z, 10 for Y, since voxel worlds are far wider
 * than they are tall. Creating a chunk outside that range throws rather than
 * aliasing onto another one.
 */
const kChunkBitsY = 10;
const kChunkBitsXZ = 11;
const kChunkBiasY = 1 << (kChunkBitsY - 1);
const kChunkBiasXZ = 1 << (kChunkBitsXZ - 1);
const kChunkSpanY = 1 << kChunkBitsY;
const kChunkSpanXZ = 1 << kChunkBitsXZ;

/**
 * Packs validated chunk coordinates into disjoint biased int32 fields.
 */
function packChunkKey(
  cx: number,
  cy: number,
  cz: number
): number {
  return ((cx + kChunkBiasXZ) << (kChunkBitsY + kChunkBitsXZ)) |
    ((cy + kChunkBiasY) << kChunkBitsXZ) |
    (cz + kChunkBiasXZ);
}

/** Unsigned compares catch both ends of each range in one test. */
function inChunkRange(
  cx: number,
  cy: number,
  cz: number
): boolean {
  return (cx + kChunkBiasXZ) >>> 0 < kChunkSpanXZ &&
    (cy + kChunkBiasY) >>> 0 < kChunkSpanY &&
    (cz + kChunkBiasXZ) >>> 0 < kChunkSpanXZ;
}

/**
 * Sparse serialized voxel key containing its layer-local position.
 */
export type VoxelEntryKey = `${number},${number},${number}`;

export interface VoxelEntryJSON {
  block: number;
  transform: number;
}

export interface VoxelLayerJSON {
  compositing?: "replace" | "composite";
  id: string;
  name: string;
  visible: boolean;
  /**
   * Rendered translucency, from `0` (fully transparent) to `1` (fully opaque).
   * Absent in files serialized before this field existed; treat as `1`.
   */
  opacity?: number;
  order: number;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  properties?: Record<string, any>;
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}

export interface VoxelLayerConfigurableOptions {
  /** Cell replacement or optical compositing. Defaults to "composite". */
  compositing?: "replace" | "composite";
  /**
   * Whether the layer is visible by default.
   * @default true
   */
  visible?: boolean;
  /**
   * Rendered translucency, from `0` (fully transparent) to `1` (fully opaque).
   * Values are clamped to `[0, 1]`. A layer with `opacity < 1` is occluded
   * only by its own voxels (like glass): nothing in another layer culls its
   * faces, and it hides neither neighbouring faces nor the voxels it covers.
   * @default 1
   */
  opacity?: number;
  /**
   * Arbitrary layer properties.
   * @default {}
   */
  properties?: Record<string, any>;
}

export interface VoxelLayerMergeOptions {
  overwrite?: boolean;
}

export interface VoxelLayerOptions extends VoxelLayerConfigurableOptions {
  /** Unique layer identifier. */
  id: string;
  /** Human-readable layer name. */
  name: string;
  /**
   * Draw order;
   * higher values render above lower ones.
   *
   */
  order: number;
  /** Size of one voxel chunk (required). */
  chunkSize: number;
  /**
   * World-space position of the layer origin.
   * @default { x: 0, y: 0, z: 0 }
   *
   */
  position?: VoxelCoord;
}

/**
 * A named, ordered layer of voxel data.
 * Voxels are organized into chunks for efficient dirty-flagging and mesh rebuilding.
 * Higher `order` values take visual priority over lower when compositing.
 */
export class VoxelLayer {
  compositing: "replace" | "composite";
  id: string;
  name: string;
  order: number;
  position: VoxelCoord;
  properties: Record<string, any> = {};
  /**
   * Set to true the frame a layer stops being effectively visible
   * (`visible` turning false, or `opacity` reaching `0`), so the renderer
   * knows to remove its chunk meshes once. Cleared the following frame.
   */
  wasVisible = false;

  #visible: boolean;
  #opacity: number;
  #chunks = new Map<number, VoxelChunk>();
  #chunkSize: number;
  #chunkShift: number;
  #chunkMask: number;
  #pendingRemoval: VoxelChunk[] = [];

  /**
   * Last chunk resolved by key. Terrain generation and brush strokes stay
   * inside one chunk for long runs, so this absorbs most of the map lookups.
   */
  #lastChunkKey = 0;
  #lastChunk: VoxelChunk | null = null;

  constructor(
    options: VoxelLayerOptions
  ) {
    const {
      id,
      name,
      order,
      chunkSize,
      visible = true,
      opacity = 1,
      compositing = "composite",
      position = { x: 0, y: 0, z: 0 },
      properties = {}
    } = options;

    assertPowerOfTwoChunkSize(chunkSize, "VoxelLayer");

    this.id = id;
    this.name = name;
    this.order = order;
    this.#chunkSize = chunkSize;
    this.#chunkShift = Math.log2(chunkSize);
    this.#chunkMask = chunkSize - 1;
    this.#visible = visible;
    this.#opacity = clamp(0, 1, opacity);
    this.compositing = compositing;
    this.position = structuredClone(position);
    this.properties = structuredClone(properties);
  }

  get visible() {
    return this.#visible;
  }

  set visible(
    value: boolean
  ) {
    this.#trackEffectiveVisibilityChange(value, this.#opacity);
    this.#visible = value;
  }

  get opacity() {
    return this.#opacity;
  }

  set opacity(
    value: number
  ) {
    const clamped = clamp(0, 1, value);
    this.#trackEffectiveVisibilityChange(this.#visible, clamped);
    this.#opacity = clamped;
  }

  /**
   * Updates `wasVisible` when "effective visibility" (visible && opacity > 0)
   * flips, regardless of whether `visible` or `opacity` triggered the flip.
   * Must be called with the pre-mutation `#visible`/`#opacity` still in place.
   */
  #trackEffectiveVisibilityChange(
    nextVisible: boolean,
    nextOpacity: number
  ): void {
    const wasEffectivelyVisible = this.#visible && this.#opacity > 0;
    const isEffectivelyVisible = nextVisible && nextOpacity > 0;

    if (wasEffectivelyVisible && !isEffectivelyVisible) {
      this.wasVisible = true;
    }
    else if (!wasEffectivelyVisible && isEffectivelyVisible) {
      this.wasVisible = false;
    }
  }

  #worldToChunk(
    w: number
  ): number {
    return w >> this.#chunkShift;
  }

  #worldToLocal(
    w: number
  ): number {
    return w & this.#chunkMask;
  }

  #toLocal(
    position: Vector3Like
  ): { x: number; y: number; z: number; } {
    return {
      x: position.x - this.position.x,
      y: position.y - this.position.y,
      z: position.z - this.position.z
    };
  }

  localToWorld(
    position: Vector3Like
  ): Vector3 {
    return new Vector3(
      position.x + this.position.x,
      position.y + this.position.y,
      position.z + this.position.z
    );
  }

  worldToLocal(
    position: Vector3Like
  ): Vector3 {
    const local = this.#toLocal(position);

    return new Vector3(local.x, local.y, local.z);
  }

  getOrCreateChunk(
    cx: number,
    cy: number,
    cz: number
  ): VoxelChunk {
    if (!inChunkRange(cx, cy, cz)) {
      throw new RangeError(
        `VoxelLayer: chunk (${cx}, ${cy}, ${cz}) is out of range ` +
        `(±${kChunkBiasXZ} on X/Z, ±${kChunkBiasY} on Y).`
      );
    }

    const key = packChunkKey(cx, cy, cz);
    if (this.#lastChunk !== null && this.#lastChunkKey === key) {
      return this.#lastChunk;
    }

    let chunk = this.#chunks.get(key);
    if (!chunk) {
      chunk = new VoxelChunk(
        [cx, cy, cz],
        this.#chunkSize
      );
      this.#chunks.set(key, chunk);
    }
    this.#lastChunkKey = key;
    this.#lastChunk = chunk;

    return chunk;
  }

  getChunk(
    cx: number,
    cy: number,
    cz: number
  ): VoxelChunk | undefined {
    /*
     * No chunk can exist outside the packable range, so this answers rather
     * than throwing — `markChunkDirty` walks past the edge of the world.
     */
    if (!inChunkRange(cx, cy, cz)) {
      return undefined;
    }

    const key = packChunkKey(cx, cy, cz);
    if (this.#lastChunk !== null && this.#lastChunkKey === key) {
      return this.#lastChunk;
    }

    const chunk = this.#chunks.get(key);
    if (chunk !== undefined) {
      this.#lastChunkKey = key;
      this.#lastChunk = chunk;
    }

    return chunk;
  }

  getVoxelAt(
    position: Vector3Like
  ): VoxelEntry | undefined {
    const packed = this.getPackedVoxelAt(position);

    return packed === VOXEL_ABSENT ? undefined : unpackVoxel(packed);
  }

  getPackedVoxelAt(
    position: Vector3Like
  ): PackedVoxel {
    const { x, y, z } = this.#toLocal(position);
    const chunk = this.getChunk(
      this.#worldToChunk(x),
      this.#worldToChunk(y),
      this.#worldToChunk(z)
    );
    if (!chunk) {
      return VOXEL_ABSENT;
    }

    return chunk.getPackedAt(
      this.#worldToLocal(x),
      this.#worldToLocal(y),
      this.#worldToLocal(z)
    );
  }

  setVoxelAt(
    position: Vector3Like,
    entry: VoxelEntry
  ): void {
    this.setPackedVoxelAt(
      position,
      packVoxel(entry.blockId, entry.transform)
    );
  }

  setPackedVoxelAt(
    position: Vector3Like,
    packed: PackedVoxel
  ): void {
    this.#setPackedLocal(this.#toLocal(position), packed);
  }

  #setPackedLocal(
    position: Vector3Like,
    packed: PackedVoxel
  ): void {
    const { x, y, z } = position;

    const cx = this.#worldToChunk(x);
    const cy = this.#worldToChunk(y);
    const cz = this.#worldToChunk(z);
    const chunk = this.getOrCreateChunk(cx, cy, cz);

    chunk.setPackedAt(
      this.#worldToLocal(x),
      this.#worldToLocal(y),
      this.#worldToLocal(z),
      packed
    );
  }

  removeVoxelAt(
    position: Vector3Like
  ): void {
    const { x, y, z } = this.#toLocal(position);

    const cx = this.#worldToChunk(x);
    const cy = this.#worldToChunk(y);
    const cz = this.#worldToChunk(z);
    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) {
      return;
    }

    chunk.delete([
      this.#worldToLocal(x),
      this.#worldToLocal(y),
      this.#worldToLocal(z)
    ]);

    // Remove the chunk entirely if it is now empty to keep memory usage low.
    if (chunk.isEmpty()) {
      // `getChunk` returned it, so the coordinates are known to be in range.
      this.#chunks.delete(packChunkKey(cx, cy, cz));
      this.#lastChunk = null;
      this.#pendingRemoval.push(chunk);
    }
  }

  localBounds(): Box3 | null {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const chunk of this.getChunks()) {
      const ox = chunk.cx * this.#chunkSize;
      const oy = chunk.cy * this.#chunkSize;
      const oz = chunk.cz * this.#chunkSize;

      const { keys, capacity } = chunk.store;
      for (let slot = 0; slot < capacity; slot++) {
        const linearIdx = keys[slot];
        if (linearIdx < 0) {
          continue;
        }
        const { lx, ly, lz } = chunk.fromLinearIndex(linearIdx);
        const x = ox + lx;
        const y = oy + ly;
        const z = oz + lz;

        if (x < minX) {
          minX = x;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (y > maxY) {
          maxY = y;
        }
        if (z < minZ) {
          minZ = z;
        }
        if (z > maxZ) {
          maxZ = z;
        }
      }
    }

    if (minX === Infinity) {
      return null;
    }

    return new Box3(
      new Vector3(minX, minY, minZ),
      new Vector3(maxX + 1, maxY + 1, maxZ + 1)
    );
  }

  worldBounds(): Box3 | null {
    const bounds = this.localBounds();
    if (bounds === null) {
      return null;
    }

    return bounds.translate(this.localToWorld({ x: 0, y: 0, z: 0 }));
  }

  worldCenter(): Vector3 {
    const bounds = this.worldBounds();

    return bounds?.getCenter(new Vector3()) ??
      this.localToWorld({ x: 0, y: 0, z: 0 });
  }

  rebase(
    position: Vector3Like
  ): void {
    if (
      position.x === this.position.x &&
      position.y === this.position.y &&
      position.z === this.position.z
    ) {
      return;
    }

    const dx = this.position.x - position.x;
    const dy = this.position.y - position.y;
    const dz = this.position.z - position.z;
    const chunks = new Map(this.#chunks);
    const entries: Array<[VoxelCoord, PackedVoxel]> = [];

    for (const chunk of chunks.values()) {
      const x0 = chunk.cx * this.#chunkSize;
      const y0 = chunk.cy * this.#chunkSize;
      const z0 = chunk.cz * this.#chunkSize;

      for (const [idx, packed] of chunk.packedEntries()) {
        const { lx, ly, lz } = chunk.fromLinearIndex(idx);
        entries.push([{
          x: x0 + lx + dx,
          y: y0 + ly + dy,
          z: z0 + lz + dz
        }, packed]);
      }
    }

    this.#chunks.clear();
    this.#lastChunk = null;
    this.position = {
      x: position.x,
      y: position.y,
      z: position.z
    };
    for (const [local, packed] of entries) {
      this.#setPackedLocal(local, packed);
    }

    for (const [key, chunk] of this.#chunks) {
      const previous = chunks.get(key);
      if (previous === undefined) {
        continue;
      }

      previous.copyFrom(chunk);
      this.#chunks.set(key, previous);
      chunks.delete(key);
    }
    this.#lastChunk = null;
    this.#pendingRemoval.push(...chunks.values());
  }

  markChunkDirty(
    cx: number,
    cy: number,
    cz: number
  ): void {
    const chunk = this.getChunk(cx, cy, cz);

    if (chunk) {
      chunk.dirty = true;
    }
  }

  * getChunks(): IterableIterator<VoxelChunk> {
    yield* this.#chunks.values();
  }

  * drainPendingRemovals(): IterableIterator<VoxelChunk> {
    while (this.#pendingRemoval.length > 0) {
      yield this.#pendingRemoval.pop()!;
    }
  }

  get chunkCount(): number {
    return this.#chunks.size;
  }

  get voxelCount(): number {
    let total = 0;
    for (const chunk of this.#chunks.values()) {
      total += chunk.voxelCount;
    }

    return total;
  }

  countBlocks(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const chunk of this.#chunks.values()) {
      for (const [blockId, count] of chunk.countBlocks()) {
        counts.set(blockId, (counts.get(blockId) ?? 0) + count);
      }
    }

    return counts;
  }

  countBlock(
    blockId: number
  ): number {
    let total = 0;
    for (const chunk of this.#chunks.values()) {
      total += chunk.countBlocks().get(blockId) ?? 0;
    }

    return total;
  }

  #exportVoxels(): Record<VoxelEntryKey, VoxelEntryJSON> {
    const voxels: Record<
      VoxelEntryKey,
      VoxelEntryJSON
    > = {};

    for (const chunk of this.getChunks()) {
      const x0 = chunk.cx * this.#chunkSize;
      const y0 = chunk.cy * this.#chunkSize;
      const z0 = chunk.cz * this.#chunkSize;

      for (const [idx, packed] of chunk.packedEntries()) {
        const { lx, ly, lz } = chunk.fromLinearIndex(idx);
        const key: VoxelEntryKey = `${x0 + lx},${y0 + ly},${z0 + lz}`;

        voxels[key] = {
          block: voxelBlockId(packed),
          transform: voxelTransform(packed)
        };
      }
    }

    return voxels;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      visible: this.#visible,
      opacity: this.#opacity,
      compositing: this.compositing,
      order: this.order,
      position: { ...this.position },
      properties: { ...this.properties },
      voxels: this.#exportVoxels()
    };
  }

  clone(
    opts: Partial<VoxelLayerOptions> = {}
  ): VoxelLayer {
    const copy = new VoxelLayer({
      id: this.id,
      name: this.name,
      order: this.order,
      visible: this.#visible,
      opacity: this.#opacity,
      compositing: this.compositing,
      position: this.position,
      properties: this.properties,
      ...opts,
      chunkSize: this.#chunkSize
    });

    for (const [key, chunk] of this.#chunks) {
      copy.#chunks.set(key, chunk.clone());
    }

    return copy;
  }

  mergeFrom(
    source: VoxelLayer,
    options: VoxelLayerMergeOptions = {}
  ): void {
    const { overwrite = true } = options;

    for (const chunk of source.getChunks()) {
      const wx0 = chunk.cx * chunk.size + source.position.x;
      const wy0 = chunk.cy * chunk.size + source.position.y;
      const wz0 = chunk.cz * chunk.size + source.position.z;

      for (const [idx, packed] of chunk.packedEntries()) {
        const { lx, ly, lz } = chunk.fromLinearIndex(idx);
        const position = {
          x: wx0 + lx,
          y: wy0 + ly,
          z: wz0 + lz
        };

        if (
          !overwrite &&
          this.getPackedVoxelAt(position) !== VOXEL_ABSENT
        ) {
          continue;
        }

        this.setPackedVoxelAt(position, packed);
      }
    }
  }
}
