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
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

export interface PixelSyncSessionOptions {
  transport: PixelTransport;
}

/**
 * Synchronizes a single canvas over one transport connection.
 * The transport is scoped to one buffer
 */
export class PixelSyncSession extends EventTarget {
  #transport: PixelTransport;
  #manager: PixelArtCanvas | undefined;
  #previousHandler: PixelBufferHookListener | undefined;
  #seq = 0;
  #ready = false;

  constructor(
    options: PixelSyncSessionOptions
  ) {
    super();
    this.#transport = options.transport;
    this.#transport.onMessage = (message) => this.#handleMessage(message);
  }

  /**
   * Whether the initial server snapshot has been applied.
   * Fires the "ready" event exactly once, the moment this flips to `true`.
   */
  get ready(): boolean {
    return this.#ready;
  }

  /**
   * Attaches a canvas to sync over the transport.
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
      this.#transport.send(
        this.#stamp(event)
      );
    };
  }

  /**
   * Detaches the canvas, restoring whatever local listener was present before `attach()`.
   */
  detach(): void {
    if (!this.#manager) {
      return;
    }

    this.#manager.onBufferUpdated = this.#previousHandler;
    this.#previousHandler = undefined;
    this.#manager = undefined;
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
      clientId: this.#transport.clientId,
      seq: ++this.#seq,
      timestamp: originTimestamp ?? Date.now()
    };
  }

  #handleMessage(
    message: PixelServerMessage
  ): void {
    switch (message.type) {
      case "snapshot":
        this.#handleSnapshot(message.data);
        break;
      case "command":
        this.#handleRemote(message.data);
        break;
    }
  }

  #handleRemote(
    cmd: PixelNetworkCommand
  ): void {
    if (cmd.clientId === this.#transport.clientId) {
      return;
    }

    this.#manager?.applyRemoteCommand(cmd);
  }

  #handleSnapshot(
    snapshot: PixelBufferSnapshot
  ): void {
    this.#manager?.loadSnapshot(
      snapshot.size,
      new Uint8ClampedArray(
        toUint8Array(snapshot.pixels)
      ),
      snapshot.uvRegions
    );

    if (!this.#ready) {
      this.#ready = true;
      this.dispatchEvent(new Event("ready"));
    }
  }

  destroy(): void {
    this.detach();
    this.#transport.onMessage = null;
  }
}
