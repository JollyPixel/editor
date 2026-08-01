// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { applyCommandToBuffer } from "./PixelCommandApplier.ts";
import { PixelBuffer } from "../buffer/PixelBuffer.ts";
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand
} from "./types.ts";

export type PixelStrokeCommand = Extract<PixelNetworkCommand, { action: "stroke"; }>;
export type PixelSelectEditCommand = Extract<PixelNetworkCommand, { action: "select-edit"; }>;
export type PixelUvRegionCommand = Extract<
  PixelNetworkCommand,
  { action: "uv-region-moved" | "uv-region-deleted"; }
>;

export type ClientHandle = network.ClientHandle;

function isPixelNetworkCommand(
  value: unknown
): value is PixelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}

export interface PixelSyncServerOptions {
  /**
   * Extension id this server is registered under. A
   * PixelSyncServer owns exactly one buffer, so a Server hosting
   * several buffers needs one instance per buffer, each under its own
   * id (e.g. `"pixel-draw:tileset-1"`).
   * @default "pixel-draw"
   */
  id?: string;
  /**
   * Existing PixelBuffer to use as the authoritative state.
   * A new, blank 1x1 buffer is created when omitted.
   */
  buffer?: PixelBuffer;
  /**
   * Custom conflict resolver.
   * Defaults to LastWriteWinsResolver.
   */
  conflictResolver?: network.ConflictResolver;
}

/**
 * Manages authoritative state for a single pixel buffer and its client synchronization.
 */
export class PixelSyncServer extends network.Extension {
  readonly id: string;
  readonly name = "pixel-draw.renderer";
  readonly buffer: PixelBuffer;

  #pixelTracker: network.ConflictTracker;
  #regionTracker: network.ConflictTracker;

  constructor(
    options: PixelSyncServerOptions = {}
  ) {
    super();
    this.id = options.id ?? "pixel-draw";
    this.buffer = options.buffer ?? new PixelBuffer({
      size: { x: 1, y: 1 }
    });
    const resolver = options.conflictResolver ?? new network.LastWriteWinsResolver();
    this.#pixelTracker = new network.ConflictTracker(resolver);
    this.#regionTracker = new network.ConflictTracker(resolver);
  }

  onClientConnect(
    client: network.ClientHandle
  ): void {
    // Sends the buffer's current snapshot to the newly connected peer.
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

  onMessage(
    _clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): void {
    if (!isPixelNetworkCommand(payload)) {
      return;
    }

    this.receive(payload, context);
  }

  receive(
    cmd: PixelNetworkCommand,
    context: network.RoomContext
  ): void {
    switch (cmd.action) {
      case "stroke":
        this.#receiveStroke(cmd, context);
        break;
      case "select-edit":
        this.#receiveSelectEdit(cmd, context);
        break;
      case "uv-region-moved":
      case "uv-region-deleted":
        this.#receiveUvRegionCommand(cmd, context);
        break;
      default:
        applyCommandToBuffer(this.buffer, cmd);
        context.room.broadcast({ type: "command", data: cmd });
    }
  }

  #receiveStroke(
    cmd: PixelStrokeCommand,
    context: network.RoomContext
  ): void {
    const accepted: PixelStrokeCommand["metadata"]["positions"] = [];

    for (const position of cmd.metadata.positions) {
      const key = `${position.x},${position.y}`;

      if (this.#pixelTracker.resolve(key, cmd) === "accept") {
        accepted.push(position);
        this.#pixelTracker.record(key, cmd);
      }
    }

    if (accepted.length === 0) {
      return;
    }

    const acceptedCmd: PixelStrokeCommand = {
      ...cmd,
      metadata: {
        ...cmd.metadata,
        positions: accepted
      }
    };

    applyCommandToBuffer(this.buffer, acceptedCmd);
    context.room.broadcast({ type: "command", data: acceptedCmd });
  }

  /**
   * Resolves per-pixel like `#receiveStroke`, sharing the same `#pixelTracker` history
   */
  #receiveSelectEdit(
    cmd: PixelSelectEditCommand,
    context: network.RoomContext
  ): void {
    const acceptedPositions: PixelSelectEditCommand["metadata"]["positions"] = [];
    const acceptedColors: PixelSelectEditCommand["metadata"]["colors"] = [];

    cmd.metadata.positions.forEach((position, index) => {
      const key = `${position.x},${position.y}`;

      if (this.#pixelTracker.resolve(key, cmd) === "accept") {
        acceptedPositions.push(position);
        acceptedColors.push(cmd.metadata.colors[index]);
        this.#pixelTracker.record(key, cmd);
      }
    });

    if (acceptedPositions.length === 0) {
      return;
    }

    const acceptedCmd: PixelSelectEditCommand = {
      ...cmd,
      metadata: {
        positions: acceptedPositions,
        colors: acceptedColors
      }
    };

    applyCommandToBuffer(
      this.buffer,
      acceptedCmd
    );
    context.room.broadcast({ type: "command", data: acceptedCmd });
  }

  /**
   * Resolves move/delete conflicts per region id (parallel to the
   * per-pixel resolution strokes use).
   */
  #receiveUvRegionCommand(
    cmd: PixelUvRegionCommand,
    context: network.RoomContext
  ): void {
    const key = cmd.metadata.id;
    if (this.#regionTracker.resolve(key, cmd) === "reject") {
      return;
    }

    this.#regionTracker.record(key, cmd);
    applyCommandToBuffer(
      this.buffer,
      cmd
    );
    context.room.broadcast({ type: "command", data: cmd });
  }

  snapshot(): PixelBufferSnapshot {
    return {
      size: this.buffer.size(),
      pixels: fromUint8Array(
        new Uint8Array(this.buffer.pixels())
      ),
      uvRegions: [...this.buffer.uvRegions]
    };
  }
}
