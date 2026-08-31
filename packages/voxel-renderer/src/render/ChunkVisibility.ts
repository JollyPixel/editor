// Import Internal Dependencies
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { ChunkMeshStore } from "./ChunkMeshStore.ts";
import type { ChunkViewport } from "./ChunkViewport.ts";

export type ChunkUnloadFn = (
  layer: VoxelLayer,
  chunk: VoxelChunk
) => void;

export interface ChunkVisibilityOptions {
  meshes: ChunkMeshStore;
  unload: ChunkUnloadFn;
}

/**
 * Hides or unloads meshed chunks as they leave the view distance, and brings
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
    if (viewport.unbounded) {
      if (this.#last !== null) {
        this.#last = null;
        this.#restoreCulled();
      }

      return;
    }

    if (!viewport.differsFrom(this.#last)) {
      return;
    }
    this.#last = viewport;

    for (const [key, entry] of this.#meshes) {
      const { layer, chunk, visible } = entry;
      const inView = viewport.contains(
        layer,
        chunk,
        visible
      );
      if (inView === visible) {
        continue;
      }

      if (!inView && viewport.policy === "unload") {
        this.#unload(layer, chunk);

        continue;
      }

      this.#meshes.cull(key, !inView);
    }
  }

  #restoreCulled(): void {
    for (const [key, entry] of this.#meshes) {
      if (!entry.visible) {
        this.#meshes.cull(key, false);
      }
    }
  }
}
