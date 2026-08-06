// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { VoxelEngine } from "../VoxelEngine.ts";
import type {
  VoxelLayerHookEvent,
  VoxelLayerHookListener
} from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage,
  VoxelWorldReplaceCommand
} from "./types.ts";

export interface VoxelSyncClientOptions {
  room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
}

/**
 * Synchronizes a single `VoxelEngine` over one `network.Room`.
 * The room is scoped to one world.
 */
export class VoxelSyncClient extends network.SyncAdapter<
  VoxelEngine,
  VoxelLayerHookEvent,
  VoxelNetworkCommand,
  VoxelWorldJSON
> {
  constructor(
    options: VoxelSyncClientOptions
  ) {
    super(options.room);
  }

  protected getHandler(
    engine: VoxelEngine
  ): VoxelLayerHookListener | undefined {
    return engine.onLayerUpdated;
  }

  protected setHandler(
    engine: VoxelEngine,
    fn: VoxelLayerHookListener | undefined
  ): void {
    engine.onLayerUpdated = fn;
  }

  protected applySnapshot(
    engine: VoxelEngine,
    snapshot: VoxelWorldJSON
  ): void {
    engine.load(snapshot);
  }

  protected applyRemoteCommand(
    engine: VoxelEngine,
    cmd: VoxelNetworkCommand
  ): void {
    // "world-replace" is never sent as a "command" message (see
    // replaceWorld()/VoxelSyncServer.receive(), which re-broadcasts it as a
    // "snapshot" instead) — this narrows the type back to VoxelLayerHookEvent
    // for engine.applyRemoteCommand() and guards defensively at runtime.
    if (cmd.action === "world-replace") {
      return;
    }

    engine.applyRemoteCommand(cmd);
  }

  /**
   * Replaces the world for every connected client (including this one),
   * which arrives back as an ordinary snapshot via `applySnapshot()`.
   */
  replaceWorld(
    data: VoxelWorldJSON
  ): void {
    this.room.send(
      this.stampCommand<VoxelWorldReplaceCommand>({ action: "world-replace", data })
    );
  }

  override destroy(): void {
    super.destroy();
    this.room.leave();
  }
}
