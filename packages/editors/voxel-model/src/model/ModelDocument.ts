// Import Third-party Dependencies
import type * as THREE from "three";
import { Emitter } from "@openally/emitt";
import {
  isModelCommand,
  type VoxelModelCommand,
  type VoxelModelSnapshot
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { ModelBlocks } from "./ModelBlocks.ts";
import { ModelFolders } from "./ModelFolders.ts";

export type ModelOrigin = "local" | "remote";

export interface ModelChange {
  command: VoxelModelCommand;
  origin: ModelOrigin;
}

export type ModelDocumentEvents = {
  change: (change: ModelChange) => void;
  reset: () => void;
};

export class ModelDocument extends Emitter<ModelDocumentEvents> {
  readonly blocks: ModelBlocks;
  readonly folders: ModelFolders;

  #onLocalCommand = (
    command: VoxelModelCommand
  ): void => {
    this.emit("change", {
      command,
      origin: "local"
    });
  };

  constructor(
    scene: THREE.Object3D
  ) {
    super();
    this.blocks = new ModelBlocks(scene);
    this.folders = new ModelFolders();

    this.blocks.on("command", this.#onLocalCommand);
    this.folders.on("command", this.#onLocalCommand);
  }

  apply(
    command: VoxelModelCommand
  ): void {
    if (isModelCommand(command)) {
      this.blocks.apply(command);
    }
    else {
      this.folders.apply(command);
    }

    this.emit("change", {
      command,
      origin: "remote"
    });
  }

  load(
    snapshot: VoxelModelSnapshot
  ): void {
    this.blocks.load(
      snapshot.nodes
    );
    this.folders.load(
      snapshot.folders,
      snapshot.placements
    );
    this.emit("reset");
  }
}
