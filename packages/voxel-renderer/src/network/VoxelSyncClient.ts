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
 * Synchronizes one `VoxelEngine` over a world-scoped room.
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
    // World replacements arrive as snapshots, never commands.
    if (cmd.action === "world-replace") {
      return;
    }

    engine.applyRemoteCommand(cmd);
  }

  /**
   * Replaces the world for every client through the snapshot path.
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
