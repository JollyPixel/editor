// Import Third-party Dependencies
import type { VoxelLayerCommand } from "@jolly-pixel/voxel.renderer";
import { EditorStore } from "@jolly-pixel/editor.host";

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
