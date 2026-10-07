// Import Third-party Dependencies
import {
  Box3,
  Vector3,
  type Vector3Like
} from "three";

// Import Internal Dependencies
import { assertPowerOfTwoChunkSize } from "./storage/chunkSize.ts";
import { VoxelChunk } from "./storage/VoxelChunk.ts";
import {
  CHUNK_BIAS_XZ,
  CHUNK_BIAS_Y,
  inChunkRange,
  packChunkKey
} from "./storage/chunkKey.ts";
import {
  packVoxel,
  voxelBlockId,
  VOXEL_ABSENT,
  type PackedVoxel
} from "./storage/packedVoxel.ts";
import type {
  VoxelEntry,
  VoxelCoord
} from "./types.ts";

// CONSTANTS
const kCellMin = new Vector3();
const kCellMax = new Vector3();
const kDefaultRank = "V";

export interface VoxelLayerConfigurableOptions {
  /** Cell replacement or optical compositing. Defaults to "composite". */
  compositing?: "replace" | "composite";
  /**
   * Whether the layer is visible by default.
   * @default true
   */
  visible?: boolean;
  /**
   * Arbitrary layer properties.
   * @default {}
   */
  properties?: Record<string, any>;
}

export interface VoxelLayerUpdate extends Partial<VoxelLayerConfigurableOptions> {
  name?: string;
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
  rank?: string;
  /** Size of one voxel chunk (required). */
  chunkSize: number;
  /**
   * World-space position of the layer origin.
   * @default { x: 0, y: 0, z: 0 }
   *
   */
  position?: VoxelCoord;
}

export interface VoxelLayerCloneOptions extends Partial<VoxelLayerOptions> {
  name: string;
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
  rank: string;
  position: VoxelCoord;
  properties: Record<string, any> = {};
  visible: boolean;

  #chunks = new Map<number, VoxelChunk>();
  #chunkSize: number;
  #chunkShift: number;
  #chunkMask: number;
  #pendingRemoval: VoxelChunk[] = [];
  #dirtyChunks = new Set<VoxelChunk>();
  #dirtySubscriptions = new Map<VoxelChunk, () => void>();
  #dirtyRevision = 0;
  #revision = 0;
  #trackDirty = (chunk: VoxelChunk, dirty: boolean): void => {
    if (dirty) {
      this.#dirtyChunks.add(chunk);
      this.#dirtyRevision++;
    }
    else {
      this.#dirtyChunks.delete(chunk);
    }
  };

  #lastChunkKey = 0;
  #lastChunk: VoxelChunk | null = null;

  constructor(
    options: VoxelLayerOptions
  ) {
    const {
      id,
      name,
      order,
      rank = kDefaultRank,
      chunkSize,
      visible = true,
      compositing = "composite",
      position = { x: 0, y: 0, z: 0 },
      properties = {}
    } = options;

    assertPowerOfTwoChunkSize(chunkSize, "VoxelLayer");

    this.id = id;
    this.name = name;
    this.order = order;
    this.rank = rank;
    this.#chunkSize = chunkSize;
    this.#chunkShift = Math.log2(chunkSize);
    this.#chunkMask = chunkSize - 1;
    this.visible = visible;
    this.compositing = compositing;
    this.position = structuredClone(position);
    this.properties = structuredClone(properties);
  }

  get chunkSize(): number {
    return this.#chunkSize;
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
        `(±${CHUNK_BIAS_XZ} on X/Z, ±${CHUNK_BIAS_Y} on Y).`
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
      this.#dirtySubscriptions.set(
        chunk, chunk.onDirtyChange(this.#trackDirty)
      );
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
    const { x, y, z } = this.#toLocal(position);

    return this.#chunkAtLocal(x, y, z)?.getAt(
      this.#worldToLocal(x),
      this.#worldToLocal(y),
      this.#worldToLocal(z)
    );
  }

  getPackedVoxelAt(
    position: Vector3Like
  ): PackedVoxel {
    const { x, y, z } = this.#toLocal(position);
    const chunk = this.#chunkAtLocal(x, y, z);
    if (!chunk) {
      return VOXEL_ABSENT;
    }

    return chunk.getPackedAt(
      this.#worldToLocal(x),
      this.#worldToLocal(y),
      this.#worldToLocal(z)
    );
  }

  getPartnerVoxelAt(
    position: Vector3Like
  ): PackedVoxel {
    const { x, y, z } = this.#toLocal(position);
    const chunk = this.#chunkAtLocal(x, y, z);
    if (!chunk) {
      return VOXEL_ABSENT;
    }

    return chunk.getPartnerAt(
      this.#worldToLocal(x),
      this.#worldToLocal(y),
      this.#worldToLocal(z)
    );
  }

  #chunkAtLocal(
    x: number,
    y: number,
    z: number
  ): VoxelChunk | undefined {
    return this.getChunk(
      this.#worldToChunk(x),
      this.#worldToChunk(y),
      this.#worldToChunk(z)
    );
  }

  setVoxelAt(
    position: Vector3Like,
    entry: VoxelEntry
  ): void {
    const { partner } = entry;

    this.setPackedVoxelAt(
      position,
      packVoxel(entry.blockId, entry.transform),
      partner === undefined ?
        VOXEL_ABSENT :
        packVoxel(partner.blockId, partner.transform)
    );
  }

  setPackedVoxelAt(
    position: Vector3Like,
    packed: PackedVoxel,
    partner: PackedVoxel = VOXEL_ABSENT
  ): void {
    if (packed === VOXEL_ABSENT) {
      this.removeVoxelAt(position);
    }
    else {
      this.#setPackedLocal(this.#toLocal(position), packed, partner);
    }
  }

  #setPackedLocal(
    position: Vector3Like,
    packed: PackedVoxel,
    partner: PackedVoxel = VOXEL_ABSENT
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
      packed,
      partner
    );
    this.#revision++;
  }

  loadPackedVoxels(
    positions: Int32Array,
    packed: ArrayLike<PackedVoxel>,
    partners?: ArrayLike<PackedVoxel>
  ): void {
    const shift = this.#chunkShift;
    const mask = this.#chunkMask;
    const count = packed.length;
    const additions = new Map<VoxelChunk, number>();
    let chunk: VoxelChunk | null = null;
    let run = 0;

    for (let i = 0; i < count; i++) {
      const next = this.getOrCreateChunk(
        positions[i * 3] >> shift,
        positions[(i * 3) + 1] >> shift,
        positions[(i * 3) + 2] >> shift
      );
      if (next !== chunk) {
        if (chunk !== null) {
          additions.set(chunk, (additions.get(chunk) ?? 0) + run);
        }
        chunk = next;
        run = 0;
      }
      run++;
    }
    if (chunk !== null) {
      additions.set(chunk, (additions.get(chunk) ?? 0) + run);
    }

    for (const [target, added] of additions) {
      target.store.reserve(target.voxelCount + added);
    }

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[(i * 3) + 1];
      const z = positions[(i * 3) + 2];

      this.getOrCreateChunk(x >> shift, y >> shift, z >> shift).setPackedAt(
        x & mask,
        y & mask,
        z & mask,
        packed[i],
        partners === undefined ? VOXEL_ABSENT : partners[i]
      );
    }
    this.#revision++;
  }

  loadPackedChunk(
    [cx, cy, cz]: [number, number, number],
    cells: ArrayLike<number>,
    voxels: ArrayLike<PackedVoxel>,
    partners?: ArrayLike<PackedVoxel>
  ): void {
    if (cells.length === 0) {
      return;
    }

    this.getOrCreateChunk(cx, cy, cz).loadPackedEntries(
      cells,
      voxels,
      partners
    );
    this.#revision++;
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
    this.#revision++;

    if (chunk.isEmpty()) {
      this.#chunks.delete(packChunkKey(cx, cy, cz));
      this.#lastChunk = null;
      this.#release(chunk);
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

    for (const [x, y, z] of this.localVoxels()) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
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
    const entries = Array.from(
      this.localVoxels(),
      ([x, y, z, packed, partner]): [VoxelCoord, PackedVoxel, PackedVoxel] => [
        {
          x: x + dx,
          y: y + dy,
          z: z + dz
        },
        packed,
        partner
      ]
    );

    this.#chunks.clear();
    this.#lastChunk = null;
    this.position = {
      x: position.x,
      y: position.y,
      z: position.z
    };
    for (const [local, packed, partner] of entries) {
      this.#setPackedLocal(local, packed, partner);
    }

    for (const [key, chunk] of this.#chunks) {
      const previous = chunks.get(key);
      if (previous === undefined) {
        continue;
      }

      previous.copyFrom(chunk);
      this.#release(chunk);
      this.#chunks.set(key, previous);
      chunks.delete(key);
    }
    this.#lastChunk = null;
    for (const chunk of chunks.values()) {
      this.#release(chunk);
    }
    this.#pendingRemoval.push(...chunks.values());
  }

  #release(
    chunk: VoxelChunk
  ): void {
    this.#dirtySubscriptions.get(chunk)?.();
    this.#dirtySubscriptions.delete(chunk);
    this.#dirtyChunks.delete(chunk);
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

  markAllDirty(): void {
    for (const chunk of this.#chunks.values()) {
      chunk.dirty = true;
    }
  }

  markCellDirty(
    position: Vector3Like
  ): void {
    kCellMin.set(position.x - 1, position.y - 1, position.z - 1);
    kCellMax.set(position.x + 1, position.y + 1, position.z + 1);
    this.markBoxDirty(kCellMin, kCellMax);
  }

  markBoxDirty(
    min: Vector3Like,
    max: Vector3Like
  ): void {
    const shift = this.#chunkShift;
    const { x, y, z } = this.position;
    const maxCx = (max.x - x) >> shift;
    const maxCy = (max.y - y) >> shift;
    const maxCz = (max.z - z) >> shift;

    for (let cx = (min.x - x) >> shift; cx <= maxCx; cx++) {
      for (let cy = (min.y - y) >> shift; cy <= maxCy; cy++) {
        for (let cz = (min.z - z) >> shift; cz <= maxCz; cz++) {
          this.markChunkDirty(cx, cy, cz);
        }
      }
    }
  }

  * getChunks(): IterableIterator<VoxelChunk> {
    yield* this.#chunks.values();
  }

  * getDirtyChunks(): IterableIterator<VoxelChunk> {
    yield* this.#dirtyChunks;
  }

  get dirtyRevision(): number {
    return this.#dirtyRevision;
  }

  get revision(): number {
    return this.#revision;
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

  clone(
    opts: Partial<VoxelLayerOptions> = {}
  ): VoxelLayer {
    const copy = new VoxelLayer({
      id: this.id,
      name: this.name,
      order: this.order,
      rank: this.rank,
      visible: this.visible,
      compositing: this.compositing,
      position: this.position,
      properties: this.properties,
      ...opts,
      chunkSize: this.#chunkSize
    });

    for (const [key, chunk] of this.#chunks) {
      const clone = chunk.clone();
      copy.#chunks.set(key, clone);
      copy.#dirtySubscriptions.set(
        clone, clone.onDirtyChange(copy.#trackDirty)
      );
    }

    return copy;
  }

  mergeFrom(
    source: VoxelLayer,
    options: VoxelLayerMergeOptions = {}
  ): void {
    const { overwrite = true } = options;

    for (const [x, y, z, packed, partner] of source.localVoxels()) {
      const position = source.localToWorld({ x, y, z });
      if (
        overwrite ||
        this.getPackedVoxelAt(position) === VOXEL_ABSENT
      ) {
        this.setPackedVoxelAt(position, packed, partner);
      }
    }
  }

  * positionsOf(
    blockIds: ReadonlySet<number>
  ): IterableIterator<VoxelCoord> {
    const size = this.#chunkSize;

    for (const chunk of this.#chunks.values()) {
      const counts = chunk.countBlocks();
      if (![...blockIds].some((id) => counts.has(id))) {
        continue;
      }

      for (const [index, packed, partner] of chunk.packedEntries()) {
        if (
          !blockIds.has(voxelBlockId(packed)) &&
          (partner === VOXEL_ABSENT || !blockIds.has(voxelBlockId(partner)))
        ) {
          continue;
        }

        const { lx, ly, lz } = chunk.fromLinearIndex(index);
        yield {
          x: (chunk.cx * size) + lx + this.position.x,
          y: (chunk.cy * size) + ly + this.position.y,
          z: (chunk.cz * size) + lz + this.position.z
        };
      }
    }
  }

  * localVoxels(): IterableIterator<
    [number, number, number, PackedVoxel, PackedVoxel]
  > {
    const size = this.#chunkSize;

    for (const chunk of this.#chunks.values()) {
      for (const [index, packed, partner] of chunk.packedEntries()) {
        const { lx, ly, lz } = chunk.fromLinearIndex(index);

        yield [
          (chunk.cx * size) + lx,
          (chunk.cy * size) + ly,
          (chunk.cz * size) + lz,
          packed,
          partner
        ];
      }
    }
  }
}
