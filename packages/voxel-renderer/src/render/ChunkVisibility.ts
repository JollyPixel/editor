// Import Internal Dependencies
import type {
  ChunkMeshEntry,
  ChunkMeshStore
} from "./ChunkMeshStore.ts";
import {
  FULL_DETAIL,
  type ChunkDetail,
  type ChunkViewport
} from "./ChunkViewport.ts";

export type ChunkUnloadFn = (
  key: string,
  entry: ChunkMeshEntry
) => void;

export type ChunkRelevelFn = (
  key: string,
  entry: ChunkMeshEntry
) => void;

export interface ChunkVisibilityOptions {
  meshes: ChunkMeshStore;
  unload: ChunkUnloadFn;
  relevel?: ChunkRelevelFn;
}

/**
 * Hides or unloads built chunks as they leave the view distance, and brings
 * them back when they return.
 */
export class ChunkVisibility {
  #meshes: ChunkMeshStore;
  #unload: ChunkUnloadFn;
  #relevel: ChunkRelevelFn;
  #last: ChunkViewport | null = null;

  constructor(
    options: ChunkVisibilityOptions
  ) {
    this.#meshes = options.meshes;
    this.#unload = options.unload;
    this.#relevel = options.relevel ?? (() => void 0);
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
    const swaps: [string, ChunkDetail][] = [];

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

      const detail = viewport.detailOf(entry.origin, entry.detail);
      if (detail === entry.detail) {
        continue;
      }
      if (detail.lod === entry.detail.lod) {
        swaps.push([key, detail]);
      }
      else {
        this.#relevel(key, entry);
      }
    }

    this.#meshes.applyDetails(swaps);
  }

  #restore(): void {
    const swaps: [string, ChunkDetail][] = [];

    for (const [key, entry] of this.#meshes) {
      if (!entry.visible) {
        this.#meshes.cull(key, false);
      }
      if (entry.meshes.length === 0) {
        continue;
      }
      if (entry.detail.lod > 0) {
        this.#relevel(key, entry);
      }
      else if (entry.detail.far) {
        swaps.push([key, FULL_DETAIL]);
      }
    }

    this.#meshes.applyDetails(swaps);
  }
}
