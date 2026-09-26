// Import Third-party Dependencies
import type { VoxelWorldJSON } from "@jolly-pixel/voxel.renderer";
import type {
  SyncedVoxelMap
} from "@jolly-pixel/asset.voxel-map/client";
import { Emitter } from "@openally/emitt";

export type WorldSourceEvents = {
  reset: () => void;
};

export interface WorldSource extends Emitter<WorldSourceEvents> {
  readonly ready: boolean;
  load(data: VoxelWorldJSON): void;
  dispose(): void;
}

export interface LeasedWorldSourceOptions {
  map: SyncedVoxelMap;
  defaultLayerName: string;
}

/**
 * Adapts the leased `SyncedVoxelMap` to the editor's reset signal. A snapshot
 * can already have landed before this source exists, so `ready` reports what
 * the lease holds rather than waiting for an event that has been and gone.
 */
export class LeasedWorldSource
  extends Emitter<WorldSourceEvents>
  implements WorldSource {
  #map: SyncedVoxelMap;
  #defaultLayerName: string;

  #onLoaded = (): void => {
    this.#seedDefaultLayer();
    this.emit("reset");
  };

  get ready(): boolean {
    return this.#map.loaded;
  }

  constructor(
    options: LeasedWorldSourceOptions
  ) {
    super();
    this.#map = options.map;
    this.#defaultLayerName = options.defaultLayerName;

    this.#map.voxels.on("loaded", this.#onLoaded);
    if (this.ready) {
      this.#seedDefaultLayer();
    }
  }

  load(
    data: VoxelWorldJSON
  ): void {
    this.#map.replaceWorld(data);
  }

  dispose(): void {
    this.#map.voxels.off("loaded", this.#onLoaded);
  }

  #seedDefaultLayer(): void {
    if (this.#map.voxels.world.getLayers().length === 0) {
      this.#map.voxels.world.addLayer(this.#defaultLayerName);
    }
  }
}
