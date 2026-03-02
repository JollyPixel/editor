// Import Internal Dependencies
import type { VoxelRenderer } from "../VoxelRenderer.ts";
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";
import type { VoxelTransport } from "./VoxelTransport.ts";
import type { VoxelNetworkCommand } from "./types.ts";

export interface VoxelSyncClientOptions {
  /**
   * The local `VoxelRenderer` instance to synchronize.
   * The client will replace its `onLayerUpdated` hook.
   */
  renderer: VoxelRenderer;
  /** Transport implementation (WebSocket, WebRTC, etc.). */
  transport: VoxelTransport;
}

/**
 * Client-side network orchestrator.
 *
 * Wires a `VoxelRenderer` to a `VoxelTransport` so that:
 * - Local mutations are stamped and forwarded to the server.
 * - Remote commands received from the server are applied without re-emitting hooks.
 * - World snapshots from the server are loaded into the renderer.
 *
 * @example
 * ```ts
 * const client = new VoxelSyncClient({ renderer: vr, transport: myTransport });
 * // …later…
 * client.destroy();
 * ```
 */
export class VoxelSyncClient {
  #renderer: VoxelRenderer;
  #transport: VoxelTransport;
  #seq = 0;

  constructor(
    options: VoxelSyncClientOptions
  ) {
    this.#renderer = options.renderer;
    this.#transport = options.transport;

    // Intercept local mutations and forward them to the transport.
    this.#renderer.onLayerUpdated = (event) => this.#handleLocal(event);

    // Apply incoming commands from remote peers without re-emitting hooks.
    this.#transport.onCommand = (cmd) => {
      if (cmd.clientId !== this.#transport.localClientId) {
        this.#renderer.applyRemoteCommand(cmd);
      }
    };

    // Load world snapshots received from the server.
    this.#transport.onSnapshot = (snapshot: VoxelWorldJSON) => {
      void this.#renderer.load(snapshot);
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
   * Detaches from the renderer and transport. Call when the session ends.
   */
  destroy(): void {
    this.#renderer.onLayerUpdated = undefined;
    this.#transport.onCommand = null;
    this.#transport.onSnapshot = null;
  }
}
