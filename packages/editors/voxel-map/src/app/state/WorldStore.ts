// Import Third-party Dependencies
import type { VoxelLayerCommand } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { EditorStore } from "./EditorStore.ts";

export type WorldStoreEvents = {
  layerUpdated: (
    event: VoxelLayerCommand
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
