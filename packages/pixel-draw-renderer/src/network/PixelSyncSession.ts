// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import type { CanvasManager } from "../CanvasManager.ts";
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
 * Client-side network orchestrator.
 *
 * A single PixelSyncSession multiplexes many buffers (textures/tilesets)
 * over one transport connection. Each attached CanvasManager still owns
 * exactly one texture — the session just assigns it a bufferId for routing,
 * so:
 * - Local mutations from an attached CanvasManager are stamped and forwarded.
 * - Remote commands are routed to the matching CanvasManager by bufferId.
 * - Buffer lifecycle (add/remove) is announced/received at the session level.
 */
export class PixelSyncSession {
  #transport: PixelTransport;
  #managers = new Map<string, CanvasManager>();
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
   * Attaches an existing CanvasManager to sync as `bufferId`. Assumes the
   * buffer already exists on the server; subscribes and awaits its snapshot.
   */
  attach(
    bufferId: string,
    canvasManager: CanvasManager
  ): void {
    if (this.#managers.has(bufferId)) {
      throw new Error(`Buffer "${bufferId}" is already attached`);
    }

    this.#managers.set(bufferId, canvasManager);
    canvasManager.onBufferUpdated = (event) => this.#handleLocal(bufferId, event);
    this.#transport.subscribe(bufferId);
  }

  /**
   * Attaches a CanvasManager AND announces a brand new buffer to peers,
   * carrying the manager's current pixel data as the initial shared state.
   */
  createBuffer(
    bufferId: string,
    canvasManager: CanvasManager,
    options: { size: Vec2; pixels?: string; }
  ): void {
    this.attach(bufferId, canvasManager);
    this.#transport.sendCommand(this.#stamp(bufferId, {
      action: "buffer-added",
      metadata: options
    }));
  }

  /** Detaches a CanvasManager without announcing its removal to peers. */
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

  /** Detaches a CanvasManager and announces its removal to peers. */
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

  /** `originTimestamp` (an undo/redo replay) is kept as the command's timestamp instead of "now"; never sent as-is over the wire. */
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
      new Uint8ClampedArray(toUint8Array(snapshot.pixels))
    );
  }

  /**
   * Detaches every buffer and clears transport callbacks. Call when the
   * session ends.
   */
  destroy(): void {
    for (const bufferId of [...this.#managers.keys()]) {
      this.detach(bufferId);
    }
    this.#transport.onCommand = null;
    this.#transport.onSnapshot = null;
  }
}
