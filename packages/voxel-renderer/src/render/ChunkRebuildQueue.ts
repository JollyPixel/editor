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
) => boolean;

/**
 * Mesh targets awaiting a rebuild, drained nearest-to-focus first under a
 * per-tick time budget.
 */
export class ChunkRebuildQueue {
  #pending: PendingRebuild[] = [];
  #head = 0;
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
    this.#head = 0;
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
    this.#compact();
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
    if (this.#head >= pending.length) {
      return;
    }

    const deadline = budgetMs > 0
      ? performance.now() + budgetMs
      : Infinity;
    let index = this.#head;

    while (index < pending.length) {
      const next = pending[index];
      const { key } = next.target;
      if (this.#queued.get(key) !== next) {
        index++;
        continue;
      }
      this.#queued.delete(key);

      if (!rebuild(next.target)) {
        if (!this.#queued.has(key)) {
          this.#queued.set(key, next);
        }
        break;
      }
      index++;

      if (performance.now() >= deadline) {
        break;
      }
    }

    this.#head = index;
    if (index >= pending.length) {
      this.#pending = [];
      this.#head = 0;
    }
    else if (index > pending.length >> 1) {
      this.#compact();
    }
  }

  #compact(): void {
    if (this.#head > 0) {
      this.#pending = this.#pending.slice(this.#head);
      this.#head = 0;
    }
  }
}
