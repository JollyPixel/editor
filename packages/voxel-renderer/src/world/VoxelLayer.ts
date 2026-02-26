// Import Third-party Dependencies
import { Vector3, type Vector3Like } from "three";

// Import Internal Dependencies
import { VoxelChunk } from "./VoxelChunk.ts";
import type { VoxelEntry, VoxelCoord } from "./types.ts";

/**
 * x,y,z voxel positions are serialised as "x,y,z" keys in a sparse map for
 */
export type VoxelEntryKey = `${number},${number},${number}`;

export interface VoxelEntryJSON {
  block: number;
  transform: number;
}

export interface VoxelLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  offset?: { x: number; y: number; z: number; };
  properties?: Record<string, any>;
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}

export interface VoxelLayerConfigurableOptions {
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

export interface VoxelLayerOptions extends VoxelLayerConfigurableOptions {
  /** Unique layer identifier. */
  id: string;
  /** Human-readable layer name. */
  name: string;
  /**
   * Draw order;
   * higher values render above lower ones.
   **/
  order: number;
  /** Size of one voxel chunk (required). */
  chunkSize: number;
  /**
   * World-space offset applied to voxels.
   * @default { x: 0, y: 0, z: 0 }
   **/
  offset?: VoxelCoord;
}

/**
 * A named, ordered layer of voxel data.
 * Voxels are organized into chunks for efficient dirty-flagging and mesh rebuilding.
 * Higher `order` values take visual priority over lower when compositing.
 */
export class VoxelLayer {
  id: string;
  name: string;
  order: number;
  offset: VoxelCoord;
  properties: Record<string, any> = {};
  wasVisible = false;

  #visible: boolean;
  #chunks = new Map<string, VoxelChunk>();
  #chunkSize: number;
  #pendingRemoval: VoxelChunk[] = [];

  constructor(
    options: VoxelLayerOptions
  ) {
    const {
      id,
      name,
      order,
      chunkSize,
      visible = true,
      offset = { x: 0, y: 0, z: 0 },
      properties = {}
    } = options;

    this.id = id;
    this.name = name;
    this.order = order;
    this.#chunkSize = chunkSize;
    this.#visible = visible;
    this.offset = structuredClone(offset);
    this.properties = structuredClone(properties);
  }

  get visible() {
    return this.#visible;
  }

  set visible(
    value: boolean
  ) {
    if (this.#visible && !value) {
      this.wasVisible = true;
    }
    else if (!this.#visible && value) {
      this.wasVisible = false;
    }

    this.#visible = value;
  }

  #createChunkKey(
    cx: number,
    cy: number,
    cz: number
  ): string {
    return `${cx},${cy},${cz}`;
  }

  #worldToChunk(
    w: number
  ): number {
    return Math.floor(w / this.#chunkSize);
  }

  #worldToLocal(
    w: number
  ): number {
    return ((w % this.#chunkSize) + this.#chunkSize) % this.#chunkSize;
  }

  #toLocal(
    position: Vector3Like
  ): { x: number; y: number; z: number; } {
    return {
      x: position.x - this.offset.x,
      y: position.y - this.offset.y,
      z: position.z - this.offset.z
    };
  }

  getOrCreateChunk(
    cx: number,
    cy: number,
    cz: number
  ): VoxelChunk {
    const key = this.#createChunkKey(cx, cy, cz);
    let chunk = this.#chunks.get(key);
    if (!chunk) {
      chunk = new VoxelChunk(
        [cx, cy, cz],
        this.#chunkSize
      );
      this.#chunks.set(key, chunk);
    }

    return chunk;
  }

  getChunk(
    cx: number,
    cy: number,
    cz: number
  ): VoxelChunk | undefined {
    return this.#chunks.get(
      this.#createChunkKey(cx, cy, cz)
    );
  }

  getVoxelAt(
    position: Vector3Like
  ): VoxelEntry | undefined {
    const { x, y, z } = this.#toLocal(position);
    const cx = this.#worldToChunk(x);
    const cy = this.#worldToChunk(y);
    const cz = this.#worldToChunk(z);
    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) {
      return undefined;
    }

    return chunk.get([
      this.#worldToLocal(x),
      this.#worldToLocal(y),
      this.#worldToLocal(z)
    ]);
  }

  setVoxelAt(
    position: Vector3Like,
    entry: VoxelEntry
  ): void {
    const { x, y, z } = this.#toLocal(position);

    const cx = this.#worldToChunk(x);
    const cy = this.#worldToChunk(y);
    const cz = this.#worldToChunk(z);
    const chunk = this.getOrCreateChunk(cx, cy, cz);

    chunk.set(
      [
        this.#worldToLocal(x),
        this.#worldToLocal(y),
        this.#worldToLocal(z)
      ],
      entry
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
      this.#chunks.delete(
        this.#createChunkKey(cx, cy, cz)
      );
      this.#pendingRemoval.push(chunk);
    }
  }

  /**
   * Returns the world-space center of all voxels in the given layer,
   * accounting for the layer offset. When the layer has no voxels the layer
   * offset itself is returned as a Vector3.
   */
  centerToWorld(): Vector3 | null {
    const { offset } = this;

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

      for (const [linearIdx] of chunk.entries()) {
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
      // No voxels — local center is the layer origin.
      return new Vector3(offset.x, offset.y, offset.z);
    }

    // +1 so the center accounts for the full unit-cube extent of each voxel.
    const localCenter = new Vector3(
      (minX + maxX + 1) / 2,
      (minY + maxY + 1) / 2,
      (minZ + maxZ + 1) / 2
    );

    return new Vector3(
      localCenter.x + offset.x,
      localCenter.y + offset.y,
      localCenter.z + offset.z
    );
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

  #exportVoxels(): Record<VoxelEntryKey, VoxelEntryJSON> {
    const voxels: Record<
      VoxelEntryKey,
      VoxelEntryJSON
    > = {};

    for (const chunk of this.getChunks()) {
      const wx0 = chunk.cx * this.#chunkSize + this.offset.x;
      const wy0 = chunk.cy * this.#chunkSize + this.offset.y;
      const wz0 = chunk.cz * this.#chunkSize + this.offset.z;

      for (const [idx, entry] of chunk.entries()) {
        const { lx, ly, lz } = chunk.fromLinearIndex(idx);
        const key: VoxelEntryKey = `${wx0 + lx},${wy0 + ly},${wz0 + lz}`;

        voxels[key] = {
          block: entry.blockId,
          transform: entry.transform
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
      order: this.order,
      offset: { ...this.offset },
      properties: { ...this.properties },
      voxels: this.#exportVoxels()
    };
  }
}
