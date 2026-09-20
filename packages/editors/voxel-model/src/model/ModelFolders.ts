// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  FolderCommand,
  FolderNodeJSON,
  FolderPlacementJSON
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { unhandledCommand } from "./unhandledCommand.ts";

export interface FolderRecord {
  name: string;
  parentId: string | null;
}

export interface AddFolderOptions {
  uuid?: string;
  name?: string;
  parentId?: string | null;
}

export type ModelFoldersEvents = {
  command: (command: FolderCommand) => void;
};

export class ModelFolders extends Emitter<ModelFoldersEvents> {
  #folders = new Map<string, FolderRecord>();
  #placements = new Map<string, string>();
  #muted = false;

  get folders(): ReadonlyMap<string, Readonly<FolderRecord>> {
    return this.#folders;
  }

  get placements(): ReadonlyMap<string, string> {
    return this.#placements;
  }

  has(
    uuid: string
  ): boolean {
    return this.#folders.has(uuid);
  }

  add(
    options: AddFolderOptions = {}
  ): string {
    const {
      uuid = crypto.randomUUID(),
      name = "Folder",
      parentId = null
    } = options;

    this.#folders.set(
      uuid,
      { name, parentId }
    );
    this.#emit({
      action: "folder-added",
      uuid,
      name,
      parentId
    });

    return uuid;
  }

  remove(
    uuid: string
  ): void {
    if (this.#folders.delete(uuid)) {
      this.#emit({
        action: "folder-removed",
        uuid
      });
    }
  }

  rename(
    uuid: string,
    name: string
  ): void {
    const folder = this.#folders.get(uuid);
    if (!folder) {
      return;
    }

    folder.name = name;
    this.#emit({
      action: "folder-renamed",
      uuid,
      name
    });
  }

  reparent(
    uuid: string,
    parentId: string | null
  ): void {
    const folder = this.#folders.get(uuid);
    if (!folder) {
      return;
    }

    folder.parentId = parentId;
    this.#emit({
      action: "folder-reparented",
      uuid,
      parentId
    });
  }

  place(
    blockUuid: string,
    folderId: string | null
  ): void {
    if (folderId === null) {
      if (this.#placements.delete(blockUuid)) {
        this.#emit({
          action: "block-unplaced",
          blockUuid
        });
      }

      return;
    }

    this.#placements.set(blockUuid, folderId);
    this.#emit({
      action: "block-placed",
      blockUuid,
      folderId
    });
  }

  nearestBlockAncestor(
    id: string | null
  ): string | null {
    const visited = new Set<string>();
    let current = id;

    while (current !== null) {
      if (visited.has(current)) {
        return null;
      }
      visited.add(current);

      const folder = this.#folders.get(current);
      if (folder === undefined) {
        return current;
      }
      current = folder.parentId;
    }

    return null;
  }

  subtreeOf(
    rootFolderId: string
  ): Set<string> {
    const subtreeIds = new Set([rootFolderId]);
    const queue = [rootFolderId];

    while (queue.length > 0) {
      const current = queue.shift();
      for (const [folderId, record] of this.#folders) {
        if (
          record.parentId === current &&
          !subtreeIds.has(folderId)
        ) {
          subtreeIds.add(folderId);
          queue.push(folderId);
        }
      }
    }

    return subtreeIds;
  }

  apply(
    command: FolderCommand
  ): void {
    this.#silently(() => {
      switch (command.action) {
        case "folder-added":
          if (!this.#folders.has(command.uuid)) {
            this.add({
              uuid: command.uuid,
              name: command.name,
              parentId: command.parentId
            });
          }
          break;

        case "folder-removed":
          this.remove(command.uuid);
          break;

        case "folder-renamed":
          this.rename(
            command.uuid,
            command.name
          );
          break;

        case "folder-reparented":
          this.reparent(
            command.uuid,
            command.parentId
          );
          break;

        case "block-placed":
          this.place(
            command.blockUuid,
            command.folderId
          );
          break;

        case "block-unplaced":
          this.place(
            command.blockUuid,
            null
          );
          break;

        default:
          throw unhandledCommand("ModelFolders.apply", command);
      }
    });
  }

  load(
    folders: readonly FolderNodeJSON[],
    placements: readonly FolderPlacementJSON[]
  ): void {
    this.#folders.clear();
    this.#placements.clear();

    for (const folder of folders) {
      this.#folders.set(folder.uuid, {
        name: folder.name,
        parentId: folder.parentId
      });
    }
    for (const placement of placements) {
      this.#placements.set(
        placement.blockUuid,
        placement.folderId
      );
    }
  }

  #emit(
    command: FolderCommand
  ): void {
    if (!this.#muted) {
      this.emit("command", command);
    }
  }

  #silently(
    fn: () => void
  ): void {
    const previous = this.#muted;
    this.#muted = true;
    try {
      fn();
    }
    finally {
      this.#muted = previous;
    }
  }
}
