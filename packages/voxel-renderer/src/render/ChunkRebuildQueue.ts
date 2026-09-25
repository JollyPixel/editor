// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { ChunkMeshTarget } from "./ChunkMeshLayout.ts";
import type { ChunkViewport } from "./ChunkViewport.ts";

interface PendingRebuild {
  target: ChunkMeshTarget;
  distance: number;
}

export type ChunkRebuildFn = (
  target: ChunkMeshTarget
) => void;

/**
 * Mesh targets awaiting a rebuild, drained nearest-to-focus first under a
 * per-tick time budget.
 */
export class ChunkRebuildQueue {
  #pending: PendingRebuild[] = [];
  #queued = new Map<string, PendingRebuild>();
  #lastSortFocus: THREE.Vector3Like | null = null;

  get size(): number {
    return this.#queued.size;
  }

  /**
   * Returns false when the target key was already queued; the newer target
   * then replaces the queued one.
   */
  push(
    target: ChunkMeshTarget
  ): boolean {
    const queued = this.#queued.get(target.key);
    if (queued !== undefined) {
      queued.target = target;

      return false;
    }

    const pending: PendingRebuild = {
      target,
      distance: 0
    };
    this.#queued.set(target.key, pending);
    this.#pending.push(pending);

    return true;
  }

  cancel(
    key: string
  ): void {
    this.#queued.delete(key);
  }

  clear(): void {
    this.#pending = [];
    this.#queued.clear();
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
        pending.target.origin
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
      const next = pending[index++];
      const { key } = next.target;
      if (this.#queued.get(key) !== next) {
        continue;
      }
      this.#queued.delete(key);

      rebuild(next.target);

      if (performance.now() >= deadline) {
        break;
      }
    }

    this.#pending = index < pending.length
      ? pending.slice(index)
      : [];
  }
}
