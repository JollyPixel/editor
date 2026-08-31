// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { ChunkViewport } from "./ChunkViewport.ts";

interface PendingRebuild {
  layer: VoxelLayer;
  chunk: VoxelChunk;
  distance: number;
}

export type ChunkRebuildFn = (
  layer: VoxelLayer,
  chunk: VoxelChunk
) => void;

/**
 * Chunks awaiting a mesh rebuild, drained nearest-to-focus first under a
 * per-tick time budget.
 */
export class ChunkRebuildQueue {
  #pending: PendingRebuild[] = [];
  #chunks = new Set<VoxelChunk>();
  #lastSortFocus: THREE.Vector3Like | null = null;

  get size(): number {
    return this.#chunks.size;
  }

  /**
   * Returns false when the chunk was already queued.
   */
  push(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): boolean {
    if (this.#chunks.has(chunk)) {
      return false;
    }

    this.#chunks.add(chunk);
    this.#pending.push({
      layer,
      chunk,
      distance: 0
    });

    return true;
  }

  cancel(
    chunk: VoxelChunk
  ): void {
    this.#chunks.delete(chunk);
  }

  clear(): void {
    this.#pending = [];
    this.#chunks.clear();
    this.#lastSortFocus = null;
  }

  focusMovedSinceSort(
    viewport: ChunkViewport
  ): boolean {
    return viewport.focusMovedFrom(
      this.#lastSortFocus
    );
  }

  sortBy(
    viewport: ChunkViewport
  ): void {
    for (const pending of this.#pending) {
      pending.distance = viewport.distanceSquaredTo(
        pending.layer,
        pending.chunk
      );
    }
    this.#pending.sort(
      (a, b) => a.distance - b.distance
    );

    this.#lastSortFocus = viewport.focus;
  }

  drain(
    budgetMs: number,
    rebuild: ChunkRebuildFn
  ): void {
    const pending = this.#pending;
    if (pending.length === 0) {
      return;
    }

    const deadline = budgetMs > 0
      ? performance.now() + budgetMs
      : Infinity;
    let index = 0;

    while (index < pending.length) {
      const { layer, chunk } = pending[index++];
      if (!this.#chunks.delete(chunk)) {
        continue;
      }

      rebuild(layer, chunk);

      if (performance.now() >= deadline) {
        break;
      }
    }

    this.#pending = index < pending.length
      ? pending.slice(index)
      : [];
  }
}
