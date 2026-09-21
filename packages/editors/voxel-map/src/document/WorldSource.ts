// Import Third-party Dependencies
import type {
  VoxelEngine,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import type * as network from "@jolly-pixel/network";
import { Emitter } from "@openally/emitt";

export type VoxelMapRoom = network.Room<
  VoxelNetworkCommand,
  VoxelServerMessage
>;

export type WorldSourceEvents = {
  reset: () => void;
};

export interface WorldSource extends Emitter<WorldSourceEvents> {
  readonly ready: boolean;
  load(data: VoxelWorldJSON): void;
  dispose(): void;
}

export interface RoomWorldSourceOptions {
  engine: VoxelEngine;
  room: VoxelMapRoom;
  defaultLayerName: string;
}

export class RoomWorldSource
  extends Emitter<WorldSourceEvents>
  implements WorldSource {
  #client: VoxelSyncClient;
  #ready = false;

  get ready(): boolean {
    return this.#ready;
  }

  constructor(
    options: RoomWorldSourceOptions
  ) {
    super();
    const { engine, room, defaultLayerName } = options;

    this.#client = new VoxelSyncClient({ room, engine });
    this.#client.on("snapshot", () => {
      if (engine.world.getLayers().length === 0) {
        engine.world.addLayer(defaultLayerName);
      }

      this.#ready = true;
      this.emit("reset");
    });
  }

  load(
    data: VoxelWorldJSON
  ): void {
    this.#client.replaceWorld(data);
  }

  dispose(): void {
    this.#client.destroy();
  }
}
