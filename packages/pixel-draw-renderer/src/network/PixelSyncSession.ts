// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import type { PixelArtCanvas } from "../PixelArtCanvas.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "../buffer/hooks.ts";
import type { PixelTransport } from "./PixelTransport.ts";
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand
} from "./types.ts";

export interface PixelSyncSessionOptions {
  transport: PixelTransport;
}

/**
 * Synchronizes a single canvas over one transport connection. The transport
 * is already scoped to one buffer (one namespace, one `PixelSyncServer`), so
 * a session attaches at most one `PixelArtCanvas` at a time.
 */
export class PixelSyncSession {
  #transport: PixelTransport;
  #manager: PixelArtCanvas | undefined;
  #previousHandler: PixelBufferHookListener | undefined;
  #seq = 0;

  constructor(
    options: PixelSyncSessionOptions
  ) {
    this.#transport = options.transport;

    this.#transport.onCommand = (cmd) => this.#handleRemote(cmd);
    this.#transport.onSnapshot = (snapshot) => this.#handleSnapshot(snapshot);
  }

  /**
   * Attaches a canvas to sync over the transport.
   *
   * Chains onto whatever local listener the canvas already had (e.g. a
   * consumer reacting to its own edits) rather than replacing it, so sync
   * can be layered onto a canvas that's already wired for local use.
   */
  attach(
    canvasManager: PixelArtCanvas
  ): void {
    if (this.#manager) {
      throw new Error("A canvas is already attached to this session");
    }

    this.#manager = canvasManager;
    this.#previousHandler = canvasManager.onBufferUpdated;
    canvasManager.onBufferUpdated = (event) => {
      this.#previousHandler?.(event);
      this.#handleLocal(event);
    };
  }

  /**
   * Detaches the canvas, restoring whatever local listener was present
   * before `attach()`.
   */
  detach(): void {
    if (!this.#manager) {
      return;
    }

    this.#manager.onBufferUpdated = this.#previousHandler;
    this.#previousHandler = undefined;
    this.#manager = undefined;
  }

  #handleLocal(
    event: PixelBufferHookEvent
  ): void {
    this.#transport.sendCommand(
      this.#stamp(event)
    );
  }

  /**
   * Uses an event's origin timestamp when available.
   */
  #stamp(
    event: PixelBufferHookEvent
  ): PixelNetworkCommand {
    const { originTimestamp, ...rest } = event;

    return {
      ...rest,
      clientId: this.#transport.localClientId,
      seq: ++this.#seq,
      timestamp: originTimestamp ?? Date.now()
    };
  }

  #handleRemote(
    cmd: PixelNetworkCommand
  ): void {
    if (cmd.clientId === this.#transport.localClientId) {
      return;
    }

    this.#manager?.applyRemoteCommand(cmd);
  }

  #handleSnapshot(
    snapshot: PixelBufferSnapshot
  ): void {
    this.#manager?.loadSnapshot(
      snapshot.size,
      new Uint8ClampedArray(toUint8Array(snapshot.pixels)),
      snapshot.uvRegions
    );
  }

  /**
   * Detaches the canvas and clears transport callbacks.
   */
  destroy(): void {
    this.detach();
    this.#transport.onCommand = null;
    this.#transport.onSnapshot = null;
  }
}
