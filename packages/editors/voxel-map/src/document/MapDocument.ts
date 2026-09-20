// Import Third-party Dependencies
import {
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  type VoxelCommand,
  type VoxelCommandListener,
  type VoxelLayerCommand,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { WorldSource } from "./WorldSource.ts";

export type MapDocumentEvents = {
  layerUpdated: (
    command: VoxelLayerCommand
  ) => void;
  blockRegistryChanged: () => void;
  tilesetsChanged: () => void;
  reset: () => void;
};

export type MapDocumentSignals = Pick<
  Emitter<MapDocumentEvents>,
  "subscribe"
>;

export interface MapDocumentEngine {
  on(event: "command", listener: VoxelCommandListener): unknown;
  off(event: "command", listener: VoxelCommandListener): unknown;
}

export interface MapDocumentOptions {
  engine: MapDocumentEngine;
  source: WorldSource;
}

export class MapDocument extends Emitter<MapDocumentEvents> {
  #engine: MapDocumentEngine;
  #source: WorldSource;

  #onCommand = (
    command: VoxelCommand
  ): void => {
    if (isVoxelLayerCommand(command)) {
      this.emit("layerUpdated", command);
    }
    else if (isVoxelBlockCommand(command)) {
      this.emit("blockRegistryChanged");
    }
    else {
      this.emit("tilesetsChanged");
    }
  };

  #onSourceReset = (): void => {
    this.emit("tilesetsChanged");
    this.emit("blockRegistryChanged");
    this.emit("reset");
  };

  get ready(): boolean {
    return this.#source.ready;
  }

  constructor(
    options: MapDocumentOptions
  ) {
    super();
    this.#engine = options.engine;
    this.#source = options.source;

    this.#engine.on("command", this.#onCommand);
    this.#source.on("reset", this.#onSourceReset);
  }

  load(
    data: VoxelWorldJSON
  ): void {
    this.#source.load(data);
  }

  dispose(): void {
    this.#engine.off("command", this.#onCommand);
    this.#source.off("reset", this.#onSourceReset);
    this.#source.dispose();
  }
}
