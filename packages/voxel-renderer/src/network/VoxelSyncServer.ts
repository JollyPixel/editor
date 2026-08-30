// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import {
  deserializeVoxelWorld,
  serializeVoxelWorld
} from "../serialization/world.ts";
import type { VoxelWorldJSON } from "../serialization/types.ts";
import { VOXEL_LAYER_HOOK_ACTIONS } from "../hooks.ts";
import { applyCommandToWorld } from "./VoxelCommandApplier.ts";
import { isVoxelNetworkCommand } from "./VoxelCommandValidator.ts";
import { VoxelCommandArbiter } from "./VoxelCommandArbiter.ts";
import type { VoxelNetworkCommand } from "./types.ts";

export type ClientHandle = network.ClientHandle;

export interface VoxelSyncServerOptions {
  /**
   * Extension ID; use one server and ID per world.
   * @default "voxel-map"
   */
  id?: string;
  /**
   * Authoritative world; omission creates a new one.
   */
  world?: VoxelWorld;
  /**
   * Chunk size for the new world (ignored when `world` is provided).
   * @default 16
   */
  chunkSize?: number;
  /**
   * Custom conflict resolver.
   * @default network.LastWriteWinsResolver
   */
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

/**
 * Headless, server-authoritative voxel world manager.
 */
export class VoxelSyncServer extends network.Extension {
  readonly id: string;
  readonly name = "voxel.renderer";
  readonly world: VoxelWorld;
  readonly events: readonly string[] = VOXEL_LAYER_HOOK_ACTIONS;

  #arbiter: VoxelCommandArbiter;

  constructor(
    options: VoxelSyncServerOptions = {}
  ) {
    super();
    const {
      id = "voxel-map",
      world,
      chunkSize = 16,
      conflictResolver
    } = options;

    this.id = id;
    this.world = world ?? new VoxelWorld(chunkSize);
    this.#arbiter = new VoxelCommandArbiter({
      conflictResolver
    });
  }

  onClientConnect(
    client: network.ClientHandle
  ): void {
    client.send({
      type: "snapshot",
      data: this.snapshot()
    });
  }

  onClientDisconnect(
    _clientId: string
  ): void {
    // The room owns client bookkeeping.
  }

  getEventName(
    payload: unknown
  ): string {
    return isVoxelNetworkCommand(payload)
      ? payload.action
      : "unknown";
  }

  onMessage(
    _clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): void {
    if (!isVoxelNetworkCommand(payload)) {
      return;
    }

    this.receive(
      payload,
      context
    );
  }

  receive(
    cmd: VoxelNetworkCommand,
    context: network.RoomContext
  ): void {
    if (cmd.action === "world-replace") {
      try {
        deserializeVoxelWorld(
          cmd.data,
          this.world
        );
      }
      catch (error) {
        console.error(
          "VoxelSyncServer: dropped invalid world-replace:",
          error
        );

        return;
      }

      context.room.broadcast({
        type: "snapshot",
        data: this.snapshot()
      });

      return;
    }

    if (!this.#arbiter.resolve(cmd)) {
      return;
    }

    // One stale client command must not terminate the shared session.
    try {
      applyCommandToWorld(this.world, cmd);
    }
    catch (error) {
      console.error(
        `VoxelSyncServer: dropped invalid command (action="${cmd.action}", layerName="${cmd.layerName}"):`,
        error
      );

      return;
    }

    this.#arbiter.record(cmd);
    this.#broadcast(cmd, context);
  }

  #broadcast(
    cmd: VoxelNetworkCommand,
    context: network.RoomContext
  ): void {
    context.room.broadcast({
      type: "command",
      data: cmd
    });
  }

  snapshot(): VoxelWorldJSON {
    return serializeVoxelWorld(this.world);
  }
}
