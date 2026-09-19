// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
import {
  isFolderCommand,
  type VoxelModelAssetNotice,
  type VoxelModelNetworkCommand,
  type VoxelModelSnapshot
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import type FolderManager from "../features/folders/FolderManager.ts";
import type {
  FolderHookEvent,
  FolderHookListener
} from "../features/folders/hooks.ts";
import type { VoxelModelRoom } from "./types.ts";

export interface FolderSyncClientOptions {
  room: VoxelModelRoom;
  folderManager: FolderManager;
}

export class FolderSyncClient extends CommandSync<
  VoxelModelNetworkCommand,
  VoxelModelSnapshot,
  VoxelModelAssetNotice
> {
  #folderManager: FolderManager;
  #previousHandler: FolderHookListener | undefined;

  #handleFolderUpdated = (
    event: FolderHookEvent
  ): void => {
    this.#previousHandler?.(event);
    this.send(event);
  };

  constructor(
    options: FolderSyncClientOptions
  ) {
    super(options.room);
    const { folderManager } = options;

    this.#folderManager = folderManager;
    this.#previousHandler = folderManager.onFolderUpdated;
    folderManager.onFolderUpdated = this.#handleFolderUpdated;
    this.on("snapshot", (snapshot) => this.#applySnapshot(snapshot));
    this.on("command", (command) => {
      if (isFolderCommand(command)) {
        this.#applyRemote(command);
      }
    });
  }

  override destroy(): void {
    this.#folderManager.onFolderUpdated = this.#previousHandler;
    super.destroy();
  }

  #applySnapshot(
    snapshot: VoxelModelSnapshot
  ): void {
    const target = this.#folderManager;

    target.silently(() => {
      target.disposeAll();

      for (const folder of snapshot.folders) {
        target.addFolder({
          uuid: folder.uuid,
          name: folder.name,
          parentId: folder.parentId
        });
      }

      for (const placement of snapshot.placements) {
        target.placeBlock(placement.blockUuid, placement.folderId);
      }
    });
  }

  #applyRemote(
    command: FolderHookEvent
  ): void {
    this.#folderManager.applyRemoteCommand(command);
    this.#previousHandler?.(command);
  }
}
