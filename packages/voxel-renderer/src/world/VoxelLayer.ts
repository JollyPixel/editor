// Import Third-party Dependencies
import type { Vector3Like } from "three";

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
  visible?: boolean;
  properties?: Record<string, any>;
}

export interface VoxelLayerOptions extends VoxelLayerConfigurableOptions {
  id: string;
  name: string;
  order: number;
  chunkSize: number;
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
    }
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
