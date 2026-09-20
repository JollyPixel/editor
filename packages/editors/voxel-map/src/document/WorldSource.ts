// Import Third-party Dependencies
import {
  blocksFromTileset,
  type TilesetSource,
  type VoxelEngine,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import type * as network from "@jolly-pixel/network";
import { Emitter } from "@openally/emitt";

// CONSTANTS
const kDefaultBlockLimit = 32;

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

export interface LocalWorldSourceOptions {
  engine: VoxelEngine;
  tilesets: TilesetSource[];
}

export class LocalWorldSource extends Emitter<
  WorldSourceEvents
> implements WorldSource {
  readonly ready = true;

  #engine: VoxelEngine;
  #tilesets: TilesetSource[];

  constructor(
    options: LocalWorldSourceOptions
  ) {
    super();
    this.#engine = options.engine;
    this.#tilesets = options.tilesets;
    this.#registerDefaultBlocks();
  }

  load(
    data: VoxelWorldJSON
  ): void {
    this.#engine.load(data, { tilesets: this.#tilesets });
    this.#registerDefaultBlocks();
    this.emit("reset");
  }

  dispose(): void {
    return void 0;
  }

  #registerDefaultBlocks(): void {
    const atlas = this.#engine.tilesetManager.get();
    if (!atlas) {
      return;
    }

    this.#engine.blockRegistry.registerMany(
      blocksFromTileset(atlas.def, { limit: kDefaultBlockLimit }),
      { skipExisting: true }
    );
  }
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
