// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { ModelTree, type ModelTreeReader } from "./ModelTree.ts";
import { createBlockTransform } from "./blockTransform.ts";
import type {
  BlockTransformJSON,
  MirrorAxes,
  ModelNodeJSON,
  NodeTransformJSON,
  VoxelModelCommand,
  VoxelModelSnapshot
} from "../network/types.ts";

export type ModelOrigin = "local" | "remote";

export interface ModelChange {
  command: VoxelModelCommand;
  origin: ModelOrigin;
  removed: readonly ModelNodeJSON[];
}

export type ModelDocumentEvents = {
  change: (change: ModelChange) => void;
  reset: () => void;
};

export interface AddFolderOptions {
  id?: string;
  name: string;
  parentId?: string | null;
}

export interface AddBlockOptions extends AddFolderOptions {
  transform?: BlockTransformJSON;
}

export class ModelDocument extends Emitter<ModelDocumentEvents> {
  #tree = new ModelTree();

  readonly tree: ModelTreeReader = this.#tree;

  addBlock(
    options: AddBlockOptions
  ): string | null {
    const {
      id = crypto.randomUUID(),
      name,
      parentId = null,
      transform = createBlockTransform()
    } = options;
    const added = this.#commit({
      action: "node-added",
      node: {
        kind: "block",
        id,
        parentId,
        name,
        transform
      }
    });

    return added ? id : null;
  }

  addFolder(
    options: AddFolderOptions
  ): string | null {
    const {
      id = crypto.randomUUID(),
      name,
      parentId = null
    } = options;
    const added = this.#commit({
      action: "node-added",
      node: {
        kind: "folder",
        id,
        parentId,
        name
      }
    });

    return added ? id : null;
  }

  remove(
    id: string
  ): boolean {
    return this.#commit({
      action: "node-removed",
      id
    });
  }

  rename(
    id: string,
    name: string
  ): boolean {
    return this.#commit({
      action: "node-renamed",
      id,
      name
    });
  }

  move(
    id: string,
    parentId: string | null,
    transforms: Iterable<NodeTransformJSON> = []
  ): boolean {
    return this.#commit({
      action: "node-moved",
      id,
      parentId,
      transforms: [...transforms]
    });
  }

  transform(
    id: string,
    transform: BlockTransformJSON,
    flipAxes?: MirrorAxes
  ): boolean {
    return this.#commit({
      action: "node-transformed",
      id,
      transform,
      ...(flipAxes ? { flipAxes } : {})
    });
  }

  apply(
    command: VoxelModelCommand
  ): void {
    this.#apply(command, "remote");
  }

  load(
    snapshot: VoxelModelSnapshot
  ): void {
    this.#tree.load(snapshot.nodes);
    this.emit("reset");
  }

  #commit(
    command: VoxelModelCommand
  ): boolean {
    if (!this.#tree.accepts(command)) {
      return false;
    }
    this.#apply(command, "local");

    return true;
  }

  #apply(
    command: VoxelModelCommand,
    origin: ModelOrigin
  ): void {
    const removed = command.action === "node-removed" ?
      this.#tree.subtreeOf(command.id) :
      [];
    this.#tree.apply(command);
    this.emit("change", {
      command,
      origin,
      removed
    });
  }
}
