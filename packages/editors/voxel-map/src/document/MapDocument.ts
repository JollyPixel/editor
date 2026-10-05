// Import Third-party Dependencies
import {
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  isVoxelMaterialGroupCommand,
  isVoxelTemplateCommand,
  isVoxelTilesetCommand,
  type ResolvedBlockDefinition,
  type VoxelCommand,
  type VoxelCommandListener,
  type VoxelLayerCommand,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { WorldSource } from "./WorldSource.ts";
import {
  KnownBlocks,
  type BlockRegistryChange
} from "./KnownBlocks.ts";

export type MapDocumentEvents = {
  layerUpdated: (
    command: VoxelLayerCommand
  ) => void;
  blockRegistryChanged: (
    change: BlockRegistryChange
  ) => void;
  tilesetsChanged: () => void;
  materialGroupsChanged: () => void;
  templatesChanged: () => void;
  reset: () => void;
};

export type MapDocumentSignals = Pick<
  Emitter<MapDocumentEvents>,
  "subscribe"
>;

export interface MapCommandSource {
  readonly blocks: Iterable<ResolvedBlockDefinition>;
  on(event: "command", listener: VoxelCommandListener): unknown;
  off(event: "command", listener: VoxelCommandListener): unknown;
}

export interface MapDocumentOptions {
  commands: MapCommandSource;
  source: WorldSource;
}

export class MapDocument extends Emitter<MapDocumentEvents> {
  #commands: MapCommandSource;
  #source: WorldSource;
  #blocks = new KnownBlocks();

  #onCommand = (
    command: VoxelCommand
  ): void => {
    if (isVoxelLayerCommand(command)) {
      this.emit("layerUpdated", command);
    }
    else if (isVoxelBlockCommand(command)) {
      this.emit("blockRegistryChanged", this.#blocks.record(command));
    }
    else if (isVoxelMaterialGroupCommand(command)) {
      this.emit("materialGroupsChanged");
    }
    else if (isVoxelTemplateCommand(command)) {
      this.emit("templatesChanged");
    }
    else if (isVoxelTilesetCommand(command)) {
      this.emit("tilesetsChanged");
    }
  };

  #onSourceReset = (): void => {
    this.#blocks.reset(this.#commands.blocks);
    this.emit("tilesetsChanged");
    this.emit("blockRegistryChanged", "reset");
    this.emit("materialGroupsChanged");
    this.emit("templatesChanged");
    this.emit("reset");
  };

  get ready(): boolean {
    return this.#source.ready;
  }

  constructor(
    options: MapDocumentOptions
  ) {
    super();
    this.#commands = options.commands;
    this.#source = options.source;
    this.#blocks.reset(this.#commands.blocks);

    this.#commands.on("command", this.#onCommand);
    this.#source.on("reset", this.#onSourceReset);
  }

  load(
    data: VoxelWorldJSON
  ): void {
    this.#source.load(data);
  }

  dispose(): void {
    this.#commands.off("command", this.#onCommand);
    this.#source.off("reset", this.#onSourceReset);
    this.#source.dispose();
  }
}
