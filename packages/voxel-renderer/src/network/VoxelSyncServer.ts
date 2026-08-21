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
   * Extension id this server is registered under. A
   * VoxelSyncServer owns exactly one world, so a Server hosting
   * several worlds needs one instance per world, each under its own id.
   * @default "voxel-map"
   */
  id?: string;
  /**
   * Existing `VoxelWorld` to use as the authoritative state.
   * A new world is created when omitted.
   */
  world?: VoxelWorld;
  /**
   * Chunk size for the new world (ignored when `world` is provided).
   * @default 16
   */
  chunkSize?: number;
  /**
   * Custom conflict resolver.
   * Defaults to `LastWriteWinsResolver`.
   */
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

/**
 * Headless, server-authoritative voxel world manager.
 *
 * Has no Three.js dependency and runs in Node.js / Deno / Bun.
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
    // Sends the world's current snapshot to the newly connected peer.
    client.send({
      type: "snapshot",
      data: this.snapshot()
    });
  }

  onClientDisconnect(
    _clientId: string
  ): void {
    // No client-list bookkeeping to clean up — Server owns that.
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
    // Out-of-band admin action: replaces the whole world and re-snapshots
    // every connected client (including the sender) rather than diffing
    // against the current one via applyCommandToWorld(). Bypasses the LWW
    // tracker entirely — a full-world replace always wins.
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

    // A client can reference a layer the server doesn't (yet) know about —
    // e.g. a stale command from before a reconnect resynced state. VoxelWorld
    // methods like setVoxelAt() throw in that case, which is correct for
    // local/programmatic use but must not crash the shared session for every
    // connected client over one bad command from one client. Recording is
    // deferred until here so a command that fails to apply never poisons the
    // tracker for that key.
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
