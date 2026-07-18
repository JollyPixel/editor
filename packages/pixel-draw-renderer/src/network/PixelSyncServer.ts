// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import { applyCommandToWorld } from "./PixelCommandApplier.ts";
import {
  LastWriteWinsResolver,
  type PixelConflictResolver
} from "./ConflictResolver.ts";
import { PixelWorld } from "./PixelWorld.ts";
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand,
  PixelNetworkCommandHeader
} from "./types.ts";

export type PixelStrokeCommand = Extract<PixelNetworkCommand, { action: "stroke"; }>;

/**
 * A connected client handle. The consumer creates these objects and passes
 * them to PixelSyncServer.connect(). The server calls send() to transmit
 * data back to the real network peer.
 */
export interface ClientHandle {
  readonly id: string;
  /**
   * Transmit data to this client over the underlying transport.
   * The consumer is responsible for framing (JSON-stringify, etc.).
   */
  send(data: unknown): void;
}

export interface PixelSyncServerOptions {
  /**
   * Existing PixelWorld to use as the authoritative state.
   * A new (empty) world is created when omitted.
   */
  world?: PixelWorld;
  /**
   * Custom conflict resolver.
   * Defaults to LastWriteWinsResolver.
   */
  conflictResolver?: PixelConflictResolver;
}

/**
 * Headless, server-authoritative pixel sync manager.
 *
 * Has no DOM/Canvas2D dependency and runs in Node.js / Deno / Bun.
 *
 * Workflow:
 * 1. connect(client) — register a peer; notifies existing peers. Sends no buffer data.
 * 2. subscribe(clientId, bufferId) — sends that buffer's current snapshot, if it exists.
 * 3. receive(cmd) — validate, apply to the world, and broadcast to subscribers of that buffer.
 * 4. disconnect(clientId) — remove the client and notify peers.
 */
export class PixelSyncServer {
  readonly world: PixelWorld;

  #clients = new Map<string, ClientHandle>();
  #subscriptions = new Map<string, Set<string>>();
  #resolver: PixelConflictResolver;
  #lastHeaderByPixel = new Map<string, PixelNetworkCommandHeader>();

  constructor(
    options: PixelSyncServerOptions = {}
  ) {
    this.world = options.world ?? new PixelWorld();
    this.#resolver = options.conflictResolver ?? new LastWriteWinsResolver();
  }

  /** Sends no buffer data — clients receive a buffer's data via subscribe(). */
  connect(
    client: ClientHandle
  ): void {
    this.#clients.set(client.id, client);

    for (const [id, peer] of this.#clients) {
      if (id !== client.id) {
        peer.send({ type: "peer-joined", peerId: client.id });
      }
    }
  }

  disconnect(
    clientId: string
  ): void {
    this.#clients.delete(clientId);
    for (const subs of this.#subscriptions.values()) {
      subs.delete(clientId);
    }

    for (const peer of this.#clients.values()) {
      peer.send({ type: "peer-left", peerId: clientId });
    }
  }

  /**
   * Subscribes a client to a buffer's future updates and sends its current
   * snapshot immediately, if the buffer already exists.
   */
  subscribe(
    clientId: string,
    bufferId: string
  ): void {
    const client = this.#clients.get(clientId);
    if (!client) {
      return;
    }

    let subs = this.#subscriptions.get(bufferId);
    if (!subs) {
      subs = new Set();
      this.#subscriptions.set(bufferId, subs);
    }
    subs.add(clientId);

    const snapshot = this.snapshot(bufferId);
    if (snapshot) {
      client.send({
        type: "snapshot",
        bufferId,
        data: snapshot
      });
    }
  }

  unsubscribe(
    clientId: string,
    bufferId: string
  ): void {
    this.#subscriptions.get(bufferId)?.delete(clientId);
  }

  /**
   * Processes an incoming command:
   * - "buffer-added": creates the buffer if it doesn't already exist, then broadcasts.
   * - "buffer-removed": deletes the buffer and its conflict-tracking state, then broadcasts.
   * - "stroke": resolves conflicts per-pixel; applies and broadcasts only the accepted
   *   pixels. Dropped entirely (no broadcast) if nothing was accepted.
   * - "resized" / "texture-replaced": always accepted, applied, and broadcast.
   *
   * Commands targeting an unknown buffer (other than "buffer-added") are dropped.
   */
  receive(
    cmd: PixelNetworkCommand
  ): void {
    if (cmd.action === "buffer-added") {
      if (this.world.hasBuffer(cmd.bufferId)) {
        return;
      }
      applyCommandToWorld(this.world, cmd);
      this.#broadcast(cmd);

      return;
    }

    if (cmd.action === "buffer-removed") {
      if (!this.world.hasBuffer(cmd.bufferId)) {
        return;
      }
      applyCommandToWorld(this.world, cmd);
      this.#subscriptions.delete(cmd.bufferId);
      this.#clearPixelHistory(cmd.bufferId);
      this.#broadcast(cmd);

      return;
    }

    if (!this.world.hasBuffer(cmd.bufferId)) {
      return;
    }

    if (cmd.action === "stroke") {
      this.#receiveStroke(cmd);

      return;
    }

    applyCommandToWorld(this.world, cmd);
    this.#broadcast(cmd);
  }

  #receiveStroke(
    cmd: PixelStrokeCommand
  ): void {
    const accepted: PixelStrokeCommand["metadata"]["positions"] = [];

    for (const position of cmd.metadata.positions) {
      const key = `${cmd.bufferId}:${position.x},${position.y}`;
      const existing = this.#lastHeaderByPixel.get(key);
      const decision = this.#resolver.resolve({
        incoming: cmd,
        existing
      });

      if (decision === "accept") {
        accepted.push(position);
        this.#lastHeaderByPixel.set(key, cmd);
      }
    }

    if (accepted.length === 0) {
      return;
    }

    const acceptedCmd: PixelStrokeCommand = {
      ...cmd,
      metadata: { ...cmd.metadata, positions: accepted }
    };

    applyCommandToWorld(this.world, acceptedCmd);
    this.#broadcast(acceptedCmd);
  }

  #clearPixelHistory(
    bufferId: string
  ): void {
    const prefix = `${bufferId}:`;
    for (const key of this.#lastHeaderByPixel.keys()) {
      if (key.startsWith(prefix)) {
        this.#lastHeaderByPixel.delete(key);
      }
    }
  }

  #broadcast(
    cmd: PixelNetworkCommand
  ): void {
    const subs = this.#subscriptions.get(cmd.bufferId);
    if (!subs) {
      return;
    }

    for (const clientId of subs) {
      this.#clients.get(clientId)?.send({ type: "command", data: cmd });
    }
  }

  snapshot(
    bufferId: string
  ): PixelBufferSnapshot | undefined {
    const buffer = this.world.getBuffer(bufferId);
    if (!buffer) {
      return undefined;
    }

    return {
      size: buffer.getSize(),
      pixels: fromUint8Array(new Uint8Array(buffer.getPixels()))
    };
  }
}
