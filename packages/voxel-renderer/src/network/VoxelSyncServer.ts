// Import Third-party Dependencies
import {
  NetworkPlugin,
  type ClientHandle
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";
import type { VoxelLayerHookEvent } from "../hooks.ts";
import { applyCommandToWorld } from "./VoxelCommandApplier.ts";
import {
  LastWriteWinsResolver,
  type VoxelConflictResolver
} from "./ConflictResolver.ts";
import type { VoxelNetworkCommand } from "./types.ts";

export type { ClientHandle };

function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}

export interface VoxelSyncServerOptions {
  /**
   * NetworkPlugin namespace this server is registered under. A
   * VoxelSyncServer owns exactly one world, so a NetworkServer hosting
   * several worlds needs one instance per world, each under its own namespace.
   * @default "voxel-map"
   */
  namespace?: string;
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
  conflictResolver?: VoxelConflictResolver;
}

/**
 * Headless, server-authoritative voxel world manager.
 *
 * Has no Three.js dependency and runs in Node.js / Deno / Bun.
 */
export class VoxelSyncServer extends NetworkPlugin {
  readonly namespace: string;
  readonly world: VoxelWorld;

  #broadcastFn: ((payload: unknown) => void) | undefined;
  #resolver: VoxelConflictResolver;
  #lastCmdByKey = new Map<string, VoxelNetworkCommand>();

  constructor(
    options: VoxelSyncServerOptions = {}
  ) {
    super();
    const {
      namespace = "voxel-map",
      world,
      chunkSize = 16,
      conflictResolver
    } = options;

    this.namespace = namespace;
    this.world = world ?? new VoxelWorld(chunkSize);
    this.#resolver = conflictResolver ?? new LastWriteWinsResolver();
  }

  onClientConnect(
    client: ClientHandle
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
    // No client-list bookkeeping to clean up — NetworkServer owns that.
  }

  attach(
    broadcast: (payload: unknown) => void
  ): void {
    this.#broadcastFn = broadcast;
  }

  onMessage(
    _clientId: string,
    payload: unknown
  ): void {
    if (!isVoxelNetworkCommand(payload)) {
      return;
    }

    this.receive(payload);
  }

  receive(
    cmd: VoxelNetworkCommand
  ): void {
    const key = this.#cmdKey(cmd);
    const existing = key === null ?
      undefined :
      this.#lastCmdByKey.get(key);

    const decision = this.#resolver.resolve({ incoming: cmd, existing });
    if (decision === "reject") {
      return;
    }

    // A client can reference a layer the server doesn't (yet) know about —
    // e.g. a stale command from before a reconnect resynced state. VoxelWorld
    // methods like setVoxelAt() throw in that case, which is correct for
    // local/programmatic use but must not crash the shared session for every
    // connected client over one bad command from one client.
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

    if (key !== null) {
      this.#lastCmdByKey.set(key, cmd);
    }

    this.#broadcast(cmd);
  }

  #broadcast(
    cmd: VoxelNetworkCommand
  ): void {
    this.#broadcastFn?.({
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
  #cmdKey(
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
