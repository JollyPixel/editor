// Import Internal Dependencies
import type { VoxelEngine } from "../VoxelEngine.ts";
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";
import type { VoxelTransport } from "./VoxelTransport.ts";
import type { VoxelNetworkCommand } from "./types.ts";

export interface VoxelSyncClientOptions {
  /**
   * The local `VoxelEngine` instance to synchronize.
   * The client will replace its `onLayerUpdated` hook.
   */
  engine: VoxelEngine;
  /** Transport implementation (WebSocket, WebRTC, etc.). */
  transport: VoxelTransport;
}

/**
 * Client-side network orchestrator.
 *
 * Wires a `VoxelEngine` to a `VoxelTransport` so that:
 * - Local mutations are stamped and forwarded to the server.
 * - Remote commands received from the server are applied without re-emitting hooks.
 * - World snapshots from the server are loaded into the engine.
 */
export class VoxelSyncClient {
  #engine: VoxelEngine;
  #transport: VoxelTransport;
  #seq = 0;

  constructor(
    options: VoxelSyncClientOptions
  ) {
    this.#engine = options.engine;
    this.#transport = options.transport;

    // Intercept local mutations and forward them to the transport.
    this.#engine.onLayerUpdated = (event) => this.#handleLocal(event);

    // Apply incoming commands from remote peers without re-emitting hooks.
    this.#transport.onCommand = (cmd) => {
      if (cmd.clientId !== this.#transport.localClientId) {
        this.#engine.applyRemoteCommand(cmd);
      }
    };

    // Load world snapshots received from the server.
    this.#transport.onSnapshot = (snapshot: VoxelWorldJSON) => {
      this.#engine.load(snapshot);
    };
  }

  #handleLocal(
    event: VoxelLayerHookEvent
  ): void {
    const cmd = {
      ...event,
      clientId: this.#transport.localClientId,
      seq: ++this.#seq,
      timestamp: Date.now()
    } as VoxelNetworkCommand;

    this.#transport.sendCommand(cmd);
  }

  /**
   * Detaches from the engine and transport. Call when the session ends.
   */
  destroy(): void {
    this.#engine.onLayerUpdated = undefined;
    this.#transport.onCommand = null;
    this.#transport.onSnapshot = null;
  }
}
