// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import type { PixelArtCanvas } from "../PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "../buffer/hooks.ts";
import type { Vec2 } from "../types.ts";
import type { PixelTransport } from "./PixelTransport.ts";
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand,
  PixelNetworkEvent
} from "./types.ts";

export interface PixelSyncSessionOptions {
  transport: PixelTransport;
}

export interface OnBufferAddedEventMetadata {
  size: Vec2;
  pixels?: string;
}

/**
 * Synchronizes multiple canvases over one transport.
 */
export class PixelSyncSession {
  #transport: PixelTransport;
  #managers = new Map<string, PixelArtCanvas>();
  #seq = 0;

  onBufferAdded: (
    (bufferId: string, metadata: OnBufferAddedEventMetadata) => void
  ) | null = null;
  onBufferRemoved: ((bufferId: string) => void) | null = null;

  constructor(
    options: PixelSyncSessionOptions
  ) {
    this.#transport = options.transport;

    this.#transport.onCommand = (cmd) => this.#handleRemote(cmd);
    this.#transport.onSnapshot = (bufferId, snapshot) => this.#handleSnapshot(
      bufferId,
      snapshot
    );
  }

  /**
   * Attaches a canvas to an existing buffer.
   */
  attach(
    bufferId: string,
    canvasManager: PixelArtCanvas
  ): void {
    if (this.#managers.has(bufferId)) {
      throw new Error(`Buffer "${bufferId}" is already attached`);
    }

    this.#managers.set(bufferId, canvasManager);
    canvasManager.onBufferUpdated = (event) => this.#handleLocal(bufferId, event);
    this.#transport.subscribe(bufferId);
  }

  /**
   * Attaches a canvas and creates its shared buffer.
   */
  createBuffer(
    bufferId: string,
    canvasManager: PixelArtCanvas,
    options: { size: Vec2; pixels?: string; }
  ): void {
    this.attach(bufferId, canvasManager);
    this.#transport.sendCommand(this.#stamp(bufferId, {
      action: "buffer-added",
      metadata: options
    }));
  }

  /**
   * Detaches a canvas without removing its shared buffer.
   */
  detach(
    bufferId: string
  ): void {
    const manager = this.#managers.get(bufferId);
    if (!manager) {
      return;
    }

    manager.onBufferUpdated = undefined;
    this.#managers.delete(bufferId);
    this.#transport.unsubscribe(bufferId);
  }

  /**
   * Detaches a canvas and removes its shared buffer.
   */
  removeBuffer(
    bufferId: string
  ): void {
    this.detach(bufferId);
    this.#transport.sendCommand(this.#stamp(bufferId, {
      action: "buffer-removed",
      metadata: {}
    }));
  }

  #handleLocal(
    bufferId: string,
    event: PixelBufferHookEvent
  ): void {
    this.#transport.sendCommand(
      this.#stamp(bufferId, event)
    );
  }

  /**
   * Uses an event's origin timestamp when available.
   */
  #stamp(
    bufferId: string,
    event: PixelNetworkEvent
  ): PixelNetworkCommand {
    const { originTimestamp, ...rest } = event;

    return {
      ...rest,
      bufferId,
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

    if (cmd.action === "buffer-added") {
      this.onBufferAdded?.(cmd.bufferId, cmd.metadata);

      return;
    }

    if (cmd.action === "buffer-removed") {
      this.detach(cmd.bufferId);
      this.onBufferRemoved?.(cmd.bufferId);

      return;
    }

    this.#managers
      .get(cmd.bufferId)
      ?.applyRemoteCommand(cmd);
  }

  #handleSnapshot(
    bufferId: string,
    snapshot: PixelBufferSnapshot
  ): void {
    this.#managers.get(bufferId)?.loadSnapshot(
      snapshot.size,
      new Uint8ClampedArray(toUint8Array(snapshot.pixels)),
      snapshot.uvRegions
    );
  }

  /**
   * Detaches all canvases and clears transport callbacks.
   */
  destroy(): void {
    for (const bufferId of [...this.#managers.keys()]) {
      this.detach(bufferId);
    }
    this.#transport.onCommand = null;
    this.#transport.onSnapshot = null;
  }
}
