// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { FolderHookEvent } from "../features/folders/hooks.ts";
import type { FolderNetworkCommand } from "./folderTypes.ts";

export interface FolderCommandArbiterOptions {
  /** @default network.LastWriteWinsResolver */
  conflictResolver?: network.ConflictResolver<FolderNetworkCommand>;
}

export class FolderCommandArbiter {
  #tracker: network.ConflictTracker<FolderNetworkCommand>;

  constructor(
    options: FolderCommandArbiterOptions = {}
  ) {
    this.#tracker = new network.ConflictTracker(
      options.conflictResolver ?? new network.LastWriteWinsResolver()
    );
  }

  admit<TCommand extends FolderNetworkCommand>(
    command: TCommand
  ): network.Admission<TCommand> | null {
    const key = FolderCommandArbiter.key(command);

    return this.#tracker.admit(command, key === null ? [] : [key]);
  }

  static key(
    command: FolderHookEvent | FolderNetworkCommand
  ): string | null {
    switch (command.action) {
      case "folder-renamed":
      case "folder-reparented":
        return `folder:${command.uuid}`;
      case "block-placed":
      case "block-unplaced":
        return `placement:${command.blockUuid}`;
      default:
        return null;
    }
  }
}
