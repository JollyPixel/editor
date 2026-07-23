// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";
import {
  NetworkPlugin,
  type ClientHandle
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { applyCommandToBuffer } from "./PixelCommandApplier.ts";
import {
  LastWriteWinsResolver,
  type PixelConflictResolver
} from "./ConflictResolver.ts";
import { PixelBuffer } from "../buffer/PixelBuffer.ts";
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand,
  PixelNetworkCommandHeader
} from "./types.ts";

export type PixelStrokeCommand = Extract<PixelNetworkCommand, { action: "stroke"; }>;
export type PixelSelectEditCommand = Extract<PixelNetworkCommand, { action: "select-edit"; }>;
export type PixelUvRegionCommand = Extract<
  PixelNetworkCommand,
  { action: "uv-region-moved" | "uv-region-deleted"; }
>;

export type { ClientHandle };

function isPixelNetworkCommand(
  value: unknown
): value is PixelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}

export interface PixelSyncServerOptions {
  /**
   * NetworkPlugin namespace this server is registered under. A
   * PixelSyncServer owns exactly one buffer, so a NetworkServer hosting
   * several buffers needs one instance per buffer, each under its own
   * namespace (e.g. `"pixel-draw:tileset-1"`).
   * @default "pixel-draw"
   */
  namespace?: string;
  /**
   * Existing PixelBuffer to use as the authoritative state.
   * A new, blank 1x1 buffer is created when omitted.
   */
  buffer?: PixelBuffer;
  /**
   * Custom conflict resolver.
   * Defaults to LastWriteWinsResolver.
   */
  conflictResolver?: PixelConflictResolver;
}

/**
 * Manages authoritative state for a single pixel buffer and its client
 * synchronization. Injected into a `NetworkServer` under its own namespace,
 * so it only ever sees clients that explicitly joined it. Peer presence
 * (join/leave notifications for other clients) is handled by `NetworkServer`
 * itself, not here.
 */
export class PixelSyncServer extends NetworkPlugin {
  readonly namespace: string;
  readonly buffer: PixelBuffer;

  #broadcastFn: ((payload: unknown) => void) | undefined;
  #resolver: PixelConflictResolver;
  #lastHeaderByPixel = new Map<string, PixelNetworkCommandHeader>();
  #lastHeaderByRegion = new Map<string, PixelNetworkCommandHeader>();

  constructor(
    options: PixelSyncServerOptions = {}
  ) {
    super();
    this.namespace = options.namespace ?? "pixel-draw";
    this.buffer = options.buffer ?? new PixelBuffer({
      size: { x: 1, y: 1 }
    });
    this.#resolver = options.conflictResolver ?? new LastWriteWinsResolver();
  }

  /**
   * Sends the buffer's current snapshot to the newly connected peer.
   * Delivery to other clients is handled by the broadcast function `attach()`
   * provides — this server doesn't track its own client list.
   */
  onClientConnect(
    client: ClientHandle
  ): void {
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

  /**
   * Receives the function `NetworkServer` uses to fan a payload out to every
   * client currently joined to this server's namespace.
   */
  attach(
    broadcast: (payload: unknown) => void
  ): void {
    this.#broadcastFn = broadcast;
  }

  onMessage(
    _clientId: string,
    payload: unknown
  ): void {
    if (!isPixelNetworkCommand(payload)) {
      return;
    }

    this.receive(payload);
  }

  /**
   * Applies and broadcasts an incoming command.
   */
  receive(
    cmd: PixelNetworkCommand
  ): void {
    if (cmd.action === "stroke") {
      this.#receiveStroke(cmd);

      return;
    }

    if (cmd.action === "select-edit") {
      this.#receiveSelectEdit(cmd);

      return;
    }

    if (
      cmd.action === "uv-region-moved" ||
      cmd.action === "uv-region-deleted"
    ) {
      this.#receiveUvRegionCommand(cmd);

      return;
    }

    applyCommandToBuffer(this.buffer, cmd);
    this.#broadcast(cmd);
  }

  #receiveStroke(
    cmd: PixelStrokeCommand
  ): void {
    const accepted: PixelStrokeCommand["metadata"]["positions"] = [];

    for (const position of cmd.metadata.positions) {
      const key = `${position.x},${position.y}`;
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
      metadata: {
        ...cmd.metadata,
        positions: accepted
      }
    };

    applyCommandToBuffer(this.buffer, acceptedCmd);
    this.#broadcast(acceptedCmd);
  }

  /**
   * Resolves per-pixel like `#receiveStroke`, sharing the same
   * `#lastHeaderByPixel` history — a select-edit and a concurrent stroke
   * touching the same pixel compete for it just like two strokes would.
   * Unlike a stroke's single uniform color, accepted positions and their
   * per-pixel colors must be filtered in lockstep.
   */
  #receiveSelectEdit(
    cmd: PixelSelectEditCommand
  ): void {
    const acceptedPositions: PixelSelectEditCommand["metadata"]["positions"] = [];
    const acceptedColors: PixelSelectEditCommand["metadata"]["colors"] = [];

    cmd.metadata.positions.forEach((position, index) => {
      const key = `${position.x},${position.y}`;
      const existing = this.#lastHeaderByPixel.get(key);
      const decision = this.#resolver.resolve({
        incoming: cmd,
        existing
      });

      if (decision === "accept") {
        acceptedPositions.push(position);
        acceptedColors.push(cmd.metadata.colors[index]);
        this.#lastHeaderByPixel.set(key, cmd);
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

    applyCommandToBuffer(this.buffer, acceptedCmd);
    this.#broadcast(acceptedCmd);
  }

  /**
   * Resolves move/delete conflicts per region id (parallel to the
   * per-pixel resolution strokes use). Create is idempotent by unique id
   * and applies unconditionally via the generic path in `receive()`.
   */
  #receiveUvRegionCommand(
    cmd: PixelUvRegionCommand
  ): void {
    const key = cmd.metadata.id;
    const existing = this.#lastHeaderByRegion.get(key);
    const decision = this.#resolver.resolve({
      incoming: cmd,
      existing
    });

    if (decision === "reject") {
      return;
    }

    this.#lastHeaderByRegion.set(key, cmd);
    applyCommandToBuffer(this.buffer, cmd);
    this.#broadcast(cmd);
  }

  #broadcast(
    cmd: PixelNetworkCommand
  ): void {
    this.#broadcastFn?.({
      type: "command",
      data: cmd
    });
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
