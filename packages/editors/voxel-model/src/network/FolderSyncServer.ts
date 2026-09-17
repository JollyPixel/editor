// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { folderProtocols } from "./FolderCommand.schema.ts";
import { FolderCommandArbiter } from "./FolderCommandArbiter.ts";
import { applyFolderCommand } from "./applyFolderCommand.ts";
import type {
  FolderNetworkCommand,
  FolderNodeJSON,
  FolderSnapshotJSON
} from "./folderTypes.ts";

export interface FolderSyncServerOptions {
  /** @default "voxel-model:folders" */
  id?: string;
  /** @default network.LastWriteWinsResolver */
  conflictResolver?: network.ConflictResolver<FolderNetworkCommand>;
}

export class FolderSyncServer extends network.Extension<FolderNetworkCommand> {
  readonly id: string;
  readonly name = "voxel-model-folders";
  readonly protocols = folderProtocols;

  #folders = new Map<string, FolderNodeJSON>();
  #placements = new Map<string, string>();
  #arbiter: FolderCommandArbiter;

  constructor(
    options: FolderSyncServerOptions = {}
  ) {
    super();
    const {
      id = "voxel-model:folders",
      conflictResolver
    } = options;

    this.id = id;
    this.#arbiter = new FolderCommandArbiter({ conflictResolver });
  }

  override onClientConnect(
    client: network.ClientHandle,
    _peer: network.RoomPeer,
    _context: network.RoomContext
  ): void {
    client.send({
      type: "snapshot",
      data: this.snapshot()
    });
  }

  override onMessage(
    _clientId: string,
    command: FolderNetworkCommand,
    context: network.RoomContext
  ): void {
    this.receive(command, context);
  }

  receive(
    cmd: FolderNetworkCommand,
    context: network.RoomContext
  ): void {
    const admitted = this.#arbiter.admit(cmd);
    if (admitted === null) {
      return;
    }

    const { command } = admitted;
    if (
      (command.action === "folder-removed" ||
        command.action === "folder-renamed" ||
        command.action === "folder-reparented") &&
        !this.#folders.has(command.uuid)
    ) {
      return;
    }

    applyFolderCommand(this.#folders, this.#placements, command);
    admitted.commit();

    context.room.broadcast({
      type: "command",
      data: command
    });
  }

  snapshot(): FolderSnapshotJSON {
    return {
      folders: [...this.#folders.values()],
      placements: [...this.#placements.entries()].map(([blockUuid, folderId]) => {
        return { blockUuid, folderId };
      })
    };
  }
}
