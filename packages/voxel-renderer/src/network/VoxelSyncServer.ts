// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import { VoxelSerializer, type VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";
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
  #serializer = new VoxelSerializer();

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
    this.#arbiter = new VoxelCommandArbiter({ conflictResolver });
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
    return isVoxelNetworkCommand(payload) ? payload.action : "unknown";
  }

  onMessage(
    _clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): void {
    if (!isVoxelNetworkCommand(payload)) {
      return;
    }

    this.receive(payload, context);
  }

  receive(
    cmd: VoxelNetworkCommand,
    context: network.RoomContext
  ): void {
    // Full-world replacement bypasses conflict arbitration.
    if (cmd.action === "world-replace") {
      this.#serializer.deserialize(cmd.data, this.world);
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
    return {
      version: 1,
      chunkSize: this.world.chunkSize,
      tilesets: [],
      layers: this.world.getLayers().map((layer) => layer.toJSON()),
      objectLayers: [...this.world.getObjectLayers()]
    };
  }
}
