// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";
import { VOXEL_LAYER_HOOK_ACTIONS, type VoxelLayerHookEvent } from "../hooks.ts";
import { applyCommandToWorld } from "./VoxelCommandApplier.ts";
import type { VoxelNetworkCommand } from "./types.ts";

export type ClientHandle = network.ClientHandle;

function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}

export interface VoxelSyncServerOptions {
  /**
   * RoomAuthority id this server is registered under. A
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
export class VoxelSyncServer extends network.RoomAuthority {
  readonly id: string;
  readonly name = "voxel.renderer";
  readonly world: VoxelWorld;
  readonly events: readonly string[] = VOXEL_LAYER_HOOK_ACTIONS;

  #tracker: network.ConflictTracker<VoxelNetworkCommand>;

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
    this.#tracker = new network.ConflictTracker(
      conflictResolver ?? new network.LastWriteWinsResolver()
    );
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
    room: network.RoomHandle
  ): void {
    if (!isVoxelNetworkCommand(payload)) {
      return;
    }

    this.receive(payload, room);
  }

  receive(
    cmd: VoxelNetworkCommand,
    room: network.RoomHandle
  ): void {
    const key = VoxelSyncServer.#cmdKey(cmd);
    if (this.#tracker.resolve(key, cmd) === "reject") {
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

    this.#tracker.record(key, cmd);
    this.#broadcast(cmd, room);
  }

  #broadcast(
    cmd: VoxelNetworkCommand,
    room: network.RoomHandle
  ): void {
    room.broadcast({
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

  /**
   * Returns a stable key for per-position conflict tracking.
   * Returns `null` for structural operations that are always accepted.
   */
  static #cmdKey(
    cmd: VoxelLayerHookEvent
  ): string | null {
    if (
      cmd.action === "voxel-set" ||
      cmd.action === "voxel-removed"
    ) {
      const { x, y, z } = cmd.metadata.position;

      return `${cmd.layerName}:${x},${y},${z}`;
    }

    return null;
  }
}
