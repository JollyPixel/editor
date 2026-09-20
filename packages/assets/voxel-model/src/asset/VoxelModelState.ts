// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  VOXEL_MODEL_DOCUMENT_VERSION,
  type VoxelModelDocument
} from "./document.ts";
import type {
  FolderNodeJSON,
  ModelNodeJSON,
  VoxelModelCommand,
  VoxelModelSnapshot
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
      case "group-removed":
      case "group-renamed":
      case "group-reparented":
      case "group-reparented-local":
      case "group-transformed":
        return this.#nodes.has(command.uuid);
    }
  }

  applyCommand(
    command: VoxelModelCommand
  ): void {
    switch (command.action) {
      case "group-added":
        this.#nodes.set(command.uuid, {
          uuid: command.uuid,
          name: command.name,
          parentUuid: null,
          ...command.transform
        });
        break;

      case "group-removed":
        this.#nodes.delete(command.uuid);
        break;

      case "group-renamed":
        this.#patchNode(command.uuid, { name: command.name });
        break;

      case "group-reparented":
        this.#patchNode(command.uuid, {
          parentUuid: command.parentUuid,
          ...command.transform
        });
        break;

      case "group-reparented-local":
        this.#patchNode(command.uuid, { parentUuid: command.parentUuid });
        break;

      case "group-transformed":
        this.#patchNode(command.uuid, {
          ...command.transform,
          ...(command.flipAxes ? { flipAxes: command.flipAxes } : {})
        });
        break;

      case "folder-added":
        this.#folders.set(command.uuid, {
          uuid: command.uuid,
          name: command.name,
          parentId: command.parentId
        });
        break;

      case "folder-removed":
        this.#folders.delete(command.uuid);
        break;

      case "folder-renamed":
        this.#patchFolder(command.uuid, { name: command.name });
        break;

      case "folder-reparented":
        this.#patchFolder(command.uuid, { parentId: command.parentId });
        break;

      case "block-placed":
        this.#placements.set(command.blockUuid, command.folderId);
        break;

      case "block-unplaced":
        this.#placements.delete(command.blockUuid);
        break;
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

  #patchNode(
    uuid: string,
    patch: Partial<ModelNodeJSON>
  ): void {
    const node = this.#nodes.get(uuid);
    if (node) {
      this.#nodes.set(uuid, { ...node, ...patch });
    }
  }

  #patchFolder(
    uuid: string,
    patch: Partial<FolderNodeJSON>
  ): void {
    const folder = this.#folders.get(uuid);
    if (folder) {
      this.#folders.set(uuid, { ...folder, ...patch });
    }
  }
}
