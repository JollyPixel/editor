// Import Third-party Dependencies
import type { CommandReconciler } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  ModelChange,
  ModelDocument
} from "../model/ModelDocument.ts";
import type {
  MaterialEntryJSON,
  ModelNodeJSON,
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "./types.ts";
import { voxelModelWriteKeys } from "./VoxelModelCommandKeys.ts";

interface ModelInverse {
  readonly added: readonly string[];
  readonly previous: readonly ModelNodeJSON[];
  readonly addedMaterials: readonly string[];
  readonly previousMaterials: readonly MaterialEntryJSON[];
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
      previous: change.previous,
      addedMaterials: addedMaterialIds(change.command),
      previousMaterials: change.previousMaterials
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
    const materials = new Map(
      [...this.#document.tree.materials.values()].map((entry) => [entry.id, entry])
    );
    for (const inverse of inverses.reverse()) {
      for (const id of inverse!.added) {
        nodes.delete(id);
      }
      for (const node of inverse!.previous) {
        nodes.set(node.id, node);
      }
      for (const id of inverse!.addedMaterials) {
        materials.delete(id);
      }
      for (const entry of inverse!.previousMaterials) {
        materials.set(entry.id, entry);
      }
    }

    this.#document.load({
      nodes: [...nodes.values()],
      materials: [...materials.values()]
    });

    return true;
  }

  replay(
    command: VoxelModelNetworkCommand
  ): boolean {
    const inverse: ModelInverse = {
      added: addedIds(command),
      previous: this.#document.tree.imagesOf(command),
      addedMaterials: addedMaterialIds(command),
      previousMaterials: this.#document.tree.materialImagesOf(command)
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

function addedMaterialIds(
  command: VoxelModelCommand
): string[] {
  switch (command.action) {
    case "material-added":
      return [command.material.id];
    case "material-folder-added":
      return [command.folder.id];
    default:
      return [];
  }
}
