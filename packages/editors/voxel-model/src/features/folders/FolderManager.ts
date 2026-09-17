// Import Internal Dependencies
import type {
  FolderHookEvent,
  FolderHookListener
} from "./hooks.ts";

export interface FolderRecord {
  name: string;
  parentId: string | null;
}

export interface AddFolderOptions {
  /** Overrides the folder's auto-generated uuid. */
  uuid?: string;
  name?: string;
  parentId?: string | null;
}

export default class FolderManager {
  #folders = new Map<string, FolderRecord>();
  #placements = new Map<string, string>();
  #muted = false;

  public onFolderUpdated: FolderHookListener | undefined;

  public silently<T>(
    fn: () => T
  ): T {
    const previous = this.#muted;
    this.#muted = true;
    try {
      return fn();
    }
    finally {
      this.#muted = previous;
    }
  }

  #emit(
    event: FolderHookEvent
  ): void {
    if (!this.#muted) {
      this.onFolderUpdated?.(event);
    }
  }

  public addFolder(
    options: AddFolderOptions = {}
  ): string {
    const {
      uuid = crypto.randomUUID(),
      name = "Folder",
      parentId = null
    } = options;

    this.#folders.set(uuid, { name, parentId });
    this.#emit({ action: "folder-added", uuid, name, parentId });

    return uuid;
  }

  public removeFolder(
    uuid: string
  ): void {
    if (!this.#folders.delete(uuid)) {
      return;
    }

    this.#emit({ action: "folder-removed", uuid });
  }

  public renameFolder(
    uuid: string,
    name: string
  ): void {
    const folder = this.#folders.get(uuid);
    if (!folder) {
      return;
    }

    folder.name = name;
    this.#emit({ action: "folder-renamed", uuid, name });
  }

  public reparentFolder(
    uuid: string,
    parentId: string | null
  ): void {
    const folder = this.#folders.get(uuid);
    if (!folder) {
      return;
    }

    folder.parentId = parentId;
    this.#emit({ action: "folder-reparented", uuid, parentId });
  }

  public placeBlock(
    blockUuid: string,
    folderId: string | null
  ): void {
    if (folderId === null) {
      if (!this.#placements.delete(blockUuid)) {
        return;
      }
      this.#emit({ action: "block-unplaced", blockUuid });

      return;
    }

    this.#placements.set(blockUuid, folderId);
    this.#emit({ action: "block-placed", blockUuid, folderId });
  }

  public getFolderOf(
    blockUuid: string
  ): string | null {
    return this.#placements.get(blockUuid) ?? null;
  }

  public hasFolder(
    uuid: string
  ): boolean {
    return this.#folders.has(uuid);
  }

  /** Iterative with a visited set: a folder chain may cycle back on itself. */
  public resolveNearestNonFolderAncestor(
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

  public collectFolderSubtreeIds(
    rootFolderId: string
  ): Set<string> {
    const subtreeIds = new Set([rootFolderId]);
    const queue = [rootFolderId];

    while (queue.length > 0) {
      const current = queue.shift();
      for (const [folderId, record] of this.#folders) {
        if (record.parentId === current && !subtreeIds.has(folderId)) {
          subtreeIds.add(folderId);
          queue.push(folderId);
        }
      }
    }

    return subtreeIds;
  }

  public getFolders(): ReadonlyMap<string, FolderRecord> {
    return this.#folders;
  }

  public getPlacements(): ReadonlyMap<string, string> {
    return this.#placements;
  }

  public applyRemoteCommand(
    cmd: FolderHookEvent
  ): void {
    this.silently(() => {
      switch (cmd.action) {
        case "folder-added":
          if (this.#folders.has(cmd.uuid)) {
            break;
          }
          this.#folders.set(cmd.uuid, { name: cmd.name, parentId: cmd.parentId });
          break;

        case "folder-removed":
          this.#folders.delete(cmd.uuid);
          break;

        case "folder-renamed": {
          const folder = this.#folders.get(cmd.uuid);
          if (folder) {
            folder.name = cmd.name;
          }
          break;
        }

        case "folder-reparented": {
          const folder = this.#folders.get(cmd.uuid);
          if (folder) {
            folder.parentId = cmd.parentId;
          }
          break;
        }

        case "block-placed":
          this.#placements.set(cmd.blockUuid, cmd.folderId);
          break;

        case "block-unplaced":
          this.#placements.delete(cmd.blockUuid);
          break;

        default: {
          const unhandled: never = cmd;
          throw new Error(
            `applyRemoteCommand: unhandled action '${(unhandled as FolderHookEvent).action}'.`
          );
        }
      }
    });
  }

  public disposeAll(): void {
    this.#folders.clear();
    this.#placements.clear();
  }
}
