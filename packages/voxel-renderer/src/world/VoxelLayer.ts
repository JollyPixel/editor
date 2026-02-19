// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import { VoxelChunk } from "./VoxelChunk.ts";
import type { VoxelEntry, VoxelCoord } from "./types.ts";

export interface VoxelLayerOptions {
  id: string;
  name: string;
  order: number;
  chunkSize: number;
  visible?: boolean;
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
  visible: boolean;
  order: number;
  offset: VoxelCoord;

  #chunks = new Map<string, VoxelChunk>();
  #chunkSize: number;

  constructor(
    options: VoxelLayerOptions
  ) {
    this.id = options.id;
    this.name = options.name;
    this.order = options.order;
    this.#chunkSize = options.chunkSize;
    this.visible = options.visible ?? true;
    this.offset = options.offset ?? { x: 0, y: 0, z: 0 };
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
}
