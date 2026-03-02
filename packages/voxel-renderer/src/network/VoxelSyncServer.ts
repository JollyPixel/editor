// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";
import type { VoxelLayerHookEvent } from "../hooks.ts";
import { applyCommandToWorld } from "./VoxelCommandApplier.ts";
import {
  LastWriteWinsResolver,
  type ConflictResolver
} from "./ConflictResolver.ts";
import type { VoxelNetworkCommand } from "./types.ts";

/**
 * A connected client handle. The consumer creates these objects and passes them
 * to `VoxelSyncServer.connect()`. The server calls `send()` to transmit data
 * back to the real network peer.
 */
export interface ClientHandle {
  /** Unique client identifier. */
  readonly id: string;
  /**
   * Transmit data to this client over the underlying transport.
   * The consumer is responsible for framing (JSON-stringify, etc.).
   */
  send(data: unknown): void;
}

export interface VoxelSyncServerOptions {
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
  conflictResolver?: ConflictResolver;
}

/**
 * Headless, server-authoritative voxel world manager.
 *
 * Has no Three.js dependency and runs in Node.js / Deno / Bun.
 *
 * Workflow:
 * 1. `connect(client)` — send current snapshot to the joining client.
 * 2. `receive(cmd)` — validate, apply to the world, and broadcast to all clients.
 * 3. `disconnect(clientId)` — remove the client and notify peers.
 *
 * @example
 * ```ts
 * const server = new VoxelSyncServer();
 *
 * wss.on("connection", (ws) => {
 *   const client: ClientHandle = {
 *     id: crypto.randomUUID(),
 *     send: (data) => ws.send(JSON.stringify(data))
 *   };
 *   server.connect(client);
 *
 *   ws.on("message", (raw) => {
 *     const cmd = JSON.parse(raw.toString()) as VoxelNetworkCommand;
 *     server.receive(cmd);
 *   });
 *
 *   ws.on("close", () => server.disconnect(client.id));
 * });
 * ```
 */
export class VoxelSyncServer {
  readonly world: VoxelWorld;

  #clients = new Map<string, ClientHandle>();
  #resolver: ConflictResolver;
  #lastCmdByKey = new Map<string, VoxelNetworkCommand>();

  constructor(
    options: VoxelSyncServerOptions = {}
  ) {
    const {
      world,
      chunkSize = 16,
      conflictResolver
    } = options;

    this.world = world ?? new VoxelWorld(chunkSize);
    this.#resolver = conflictResolver ?? new LastWriteWinsResolver();
  }

  /**
   * Registers a new client and sends them the current world snapshot.
   * Notifies all existing peers that a new client has joined.
   */
  connect(client: ClientHandle): void {
    this.#clients.set(client.id, client);

    // Send the full snapshot to the joining client.
    client.send(this.snapshot());

    // Notify existing peers.
    for (const [id, peer] of this.#clients) {
      if (id !== client.id) {
        peer.send({ type: "peer-joined", peerId: client.id });
      }
    }
  }

  /**
   * Removes a client from the session and notifies remaining peers.
   */
  disconnect(
    clientId: string
  ): void {
    this.#clients.delete(clientId);

    for (const peer of this.#clients.values()) {
      peer.send({ type: "peer-left", peerId: clientId });
    }
  }

  /**
   * Processes an incoming command:
   * 1. Resolves any conflict with the last accepted command at the same position.
   * 2. If accepted: applies the command to the world and broadcasts it.
   * 3. If rejected: silently drops it (rollback signals are left to consumers).
   */
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

    applyCommandToWorld(this.world, cmd);

    if (key !== null) {
      this.#lastCmdByKey.set(key, cmd);
    }

    // Broadcast the accepted command to all connected clients.
    for (const client of this.#clients.values()) {
      client.send(cmd);
    }
  }

  /**
   * Produces a full JSON snapshot of the current world state.
   * Tilesets are omitted (server is headless; no texture data).
   */
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
    if (cmd.action === "voxel-set" || cmd.action === "voxel-removed") {
      const { x, y, z } = cmd.metadata.position as { x: number; y: number; z: number; };

      return `${cmd.layerName}:${x},${y},${z}`;
    }

    return null;
  }
}
