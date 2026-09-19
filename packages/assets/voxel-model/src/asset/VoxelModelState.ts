// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  VOXEL_MODEL_DOCUMENT_VERSION,
  type VoxelModelDocument
} from "./document.ts";
import { applyModelCommand } from "../network/applyModelCommand.ts";
import { applyFolderCommand } from "../network/applyFolderCommand.ts";
import {
  isModelCommand,
  type FolderNodeJSON,
  type ModelNodeJSON,
  type VoxelModelCommand,
  type VoxelModelSnapshot
} from "../network/types.ts";

export class VoxelModelState {
  #nodes = new Map<string, ModelNodeJSON>();
  #folders = new Map<string, FolderNodeJSON>();
  #placements = new Map<string, string>();
  #texture: AssetReferenceData | null = null;

  get texture(): AssetReferenceData | null {
    return this.#texture === null ?
      null :
      { ...this.#texture };
  }

  load(
    document: VoxelModelDocument
  ): void {
    this.clear();
    for (const node of document.nodes) {
      this.#nodes.set(node.uuid, structuredClone(node));
    }
    for (const folder of document.folders) {
      this.#folders.set(folder.uuid, { ...folder });
    }
    for (const { blockUuid, folderId } of document.placements) {
      this.#placements.set(blockUuid, folderId);
    }
    this.#texture = document.texture === undefined ?
      null :
      {
        id: document.texture.id,
        kind: document.texture.kind
      };
  }

  clear(): void {
    this.#nodes.clear();
    this.#folders.clear();
    this.#placements.clear();
    this.#texture = null;
  }

  accepts(
    command: VoxelModelCommand
  ): boolean {
    switch (command.action) {
      case "group-added":
      case "folder-added":
      case "block-placed":
      case "block-unplaced":
        return true;
      case "folder-removed":
      case "folder-renamed":
      case "folder-reparented":
        return this.#folders.has(command.uuid);
      default:
        return this.#nodes.has(command.uuid);
    }
  }

  applyCommand(
    command: VoxelModelCommand
  ): void {
    if (isModelCommand(command)) {
      applyModelCommand(this.#nodes, command);
    }
    else {
      applyFolderCommand(this.#folders, this.#placements, command);
    }
  }

  dependencies(): AssetReferenceData[] {
    return this.#texture === null ? [] : [{ ...this.#texture }];
  }

  snapshot(): VoxelModelSnapshot {
    return {
      nodes: [...this.#nodes.values()].map((node) => structuredClone(node)),
      folders: [...this.#folders.values()].map((folder) => {
        return { ...folder };
      }),
      placements: Array.from(this.#placements, ([blockUuid, folderId]) => {
        return {
          blockUuid,
          folderId
        };
      })
    };
  }

  toJSON(): VoxelModelDocument {
    const document: VoxelModelDocument = {
      version: VOXEL_MODEL_DOCUMENT_VERSION,
      ...this.snapshot()
    };
    if (this.#texture !== null) {
      document.texture = { ...this.#texture };
    }

    return document;
  }
}
