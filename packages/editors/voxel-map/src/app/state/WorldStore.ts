// Import Third-party Dependencies
import type { VoxelLayerHookEvent } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { EditorStore } from "./EditorStore.ts";

export type WorldStoreEvents = {
  layerUpdated: (
    event: VoxelLayerHookEvent
  ) => void;
  blockRegistryChanged: () => void;
  reset: () => void;
};

export class WorldStore extends EditorStore<WorldStoreEvents> {
  #blocksReady = true;

  get blocksReady(): boolean {
    return this.#blocksReady;
  }

  set blocksReady(ready: boolean) {
    this.#blocksReady = ready;
  }
}
