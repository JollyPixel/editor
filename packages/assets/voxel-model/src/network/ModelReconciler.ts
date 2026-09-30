// Import Third-party Dependencies
import type { CommandReconciler } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  ModelChange,
  ModelDocument
} from "../model/ModelDocument.ts";
import type {
  ModelNodeJSON,
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "./types.ts";
import { voxelModelWriteKeys } from "./VoxelModelCommandKeys.ts";

interface ModelInverse {
  readonly added: readonly string[];
  readonly previous: readonly ModelNodeJSON[];
}

export class ModelReconciler implements CommandReconciler<VoxelModelNetworkCommand> {
  #document: ModelDocument;
  #inverses = new WeakMap<VoxelModelNetworkCommand, ModelInverse>();

  constructor(
    document: ModelDocument
  ) {
    this.#document = document;
  }

  keys(
    command: VoxelModelNetworkCommand
  ): readonly string[] | null {
    return voxelModelWriteKeys(command);
  }

  narrow(): VoxelModelNetworkCommand | null {
    return null;
  }

  capture(
    command: VoxelModelNetworkCommand,
    change: ModelChange
  ): void {
    this.#inverses.set(command, {
      added: addedIds(change.command),
      previous: change.previous
    });
  }

  revert(
    pending: readonly VoxelModelNetworkCommand[]
  ): boolean {
    const inverses = pending.map((command) => this.#inverses.get(command));
    if (inverses.some((inverse) => inverse === undefined)) {
      return false;
    }
    if (inverses.length === 0) {
      return true;
    }

    const nodes = new Map(
      [...this.#document.tree.values()].map((node) => [node.id, node])
    );
    for (const inverse of inverses.reverse()) {
      for (const id of inverse!.added) {
        nodes.delete(id);
      }
      for (const node of inverse!.previous) {
        nodes.set(node.id, node);
      }
    }

    this.#document.load({
      nodes: [...nodes.values()]
    });

    return true;
  }

  replay(
    command: VoxelModelNetworkCommand
  ): boolean {
    const inverse: ModelInverse = {
      added: addedIds(command),
      previous: this.#document.tree.imagesOf(command)
    };
    if (!this.#document.apply(command)) {
      this.#inverses.delete(command);

      return false;
    }
    this.#inverses.set(command, inverse);

    return true;
  }
}

function addedIds(
  command: VoxelModelCommand
): string[] {
  return command.action === "node-added" ? [command.node.id] : [];
}
