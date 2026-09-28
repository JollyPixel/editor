// Import Internal Dependencies
import type {
  ChunkMeshEntry,
  ChunkMeshStore
} from "./ChunkMeshStore.ts";
import type { ChunkViewport } from "./ChunkViewport.ts";

export type ChunkUnloadFn = (
  key: string,
  entry: ChunkMeshEntry
) => void;

export interface ChunkVisibilityOptions {
  meshes: ChunkMeshStore;
  unload: ChunkUnloadFn;
}

/**
 * Hides or unloads built chunks as they leave the view distance, and brings
 * them back when they return.
 */
export class ChunkVisibility {
  #meshes: ChunkMeshStore;
  #unload: ChunkUnloadFn;
  #last: ChunkViewport | null = null;

  constructor(
    options: ChunkVisibilityOptions
  ) {
    this.#meshes = options.meshes;
    this.#unload = options.unload;
  }

  reset(): void {
    this.#last = null;
  }

  update(
    viewport: ChunkViewport
  ): void {
    if (viewport.unbounded && !viewport.detailed) {
      if (this.#last !== null) {
        this.#last = null;
        this.#restore();
      }

      return;
    }

    if (!viewport.differsFrom(this.#last)) {
      return;
    }
    this.#last = viewport;
    const swaps: [string, boolean][] = [];

    for (const [key, entry] of this.#meshes) {
      const inView = viewport.contains(entry.origin, entry.visible);
      if (inView !== entry.visible) {
        if (!inView && viewport.policy === "unload") {
          this.#unload(key, entry);

          continue;
        }

        this.#meshes.cull(key, !inView);
      }
      if (entry.meshes.length === 0) {
        continue;
      }

      const far = viewport.isFar(entry.origin, entry.far);
      if (far !== entry.far) {
        swaps.push([key, far]);
      }
    }

    this.#meshes.applyFar(swaps);
  }

  #restore(): void {
    const swaps: [string, boolean][] = [];

    for (const [key, entry] of this.#meshes) {
      if (!entry.visible) {
        this.#meshes.cull(key, false);
      }
      if (entry.meshes.length > 0 && entry.far) {
        swaps.push([key, false]);
      }
    }

    this.#meshes.applyFar(swaps);
  }
}
