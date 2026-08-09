// Import Third-party Dependencies
import {
  fromUint8Array
} from "js-base64";
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  applyCommandToBuffer
} from "./PixelCommandApplier.ts";
import {
  PixelBuffer
} from "../buffer/PixelBuffer.ts";
import {
  UV_FACES
} from "../uv/UVRegion.ts";
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand
} from "./types.ts";

export type PixelStrokeCommand = Extract<PixelNetworkCommand, { action: "stroke"; }>;
export type PixelSelectEditCommand = Extract<PixelNetworkCommand, { action: "select-edit"; }>;
export type PixelUvRegionCommand = Extract<
  PixelNetworkCommand,
  { action: "uv-region-moved" | "uv-region-deleted" | "uv-region-state-changed"; }
>;

/**
 * Conflict keys for a UV command. Move affects only one face;
 * delete/state changes affect all.
 */
function uvConflictKeys(
  command: PixelUvRegionCommand
): string[] {
  if (command.action === "uv-region-moved") {
    return [
      `${command.metadata.id}:${command.metadata.face ?? "*"}`
    ];
  }

  const id = command.action === "uv-region-deleted" ?
    command.metadata.id :
    command.metadata.region.id;

  return [
    `${id}:*`,
    ...UV_FACES.map((face) => `${id}:${face}`)
  ];
}

export type ClientHandle = network.ClientHandle;

function isPixelNetworkCommand(
  value: unknown
): value is PixelNetworkCommand {
  return typeof value === "object" && value !== null &&
    "action" in value && "clientId" in value;
}

export interface PixelSyncServerOptions {
  /**
   * Extension id (one per buffer).
   * @default "pixel-draw"
   */
  id?: string;
  /**
   * Authoritative buffer (creates a new 1x1 buffer if omitted).
   */
  buffer?: PixelBuffer;
  /**
   * Conflict resolver (defaults to LastWriteWinsResolver).
   */
  conflictResolver?: network.ConflictResolver;
}

/**
 * Manages authoritative buffer state and client synchronization.
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
    // Send the current buffer snapshot to the new client.
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
    command: PixelNetworkCommand,
    context: network.RoomContext
  ): void {
    switch (command.action) {
      case "stroke":
        this.#receiveStroke(
          command,
          context
        );
        break;
      case "select-edit":
        this.#receiveSelectEdit(
          command,
          context
        );
        break;
      case "uv-region-moved":
      case "uv-region-deleted":
      case "uv-region-state-changed":
        this.#receiveUvRegionCommand(
          command,
          context
        );
        break;
      default:
        applyCommandToBuffer(
          this.buffer,
          command
        );
        context.room.broadcast({
          type: "command",
          data: command
        });
    }
  }

  #receiveStroke(
    command: PixelStrokeCommand,
    context: network.RoomContext
  ): void {
    const accepted: PixelStrokeCommand["metadata"]["positions"] = [];

    for (const position of command.metadata.positions) {
      const key = `${position.x},${position.y}`;

      if (this.#pixelTracker.resolve(key, command) === "accept") {
        accepted.push(position);
        this.#pixelTracker.record(key, command);
      }
    }

    if (accepted.length === 0) {
      return;
    }

    const acceptedCommand: PixelStrokeCommand = {
      ...command,
      metadata: {
        ...command.metadata,
        positions: accepted
      }
    };

    applyCommandToBuffer(
      this.buffer,
      acceptedCommand
    );
    context.room.broadcast({
      type: "command",
      data: acceptedCommand
    });
  }

  /**
   * Resolves per-pixel like `#receiveStroke`, sharing the same `#pixelTracker` history
   */
  #receiveSelectEdit(
    command: PixelSelectEditCommand,
    context: network.RoomContext
  ): void {
    const acceptedPositions: PixelSelectEditCommand["metadata"]["positions"] = [];
    const acceptedColors: PixelSelectEditCommand["metadata"]["colors"] = [];

    command.metadata.positions.forEach((position, index) => {
      const key = `${position.x},${position.y}`;

      if (this.#pixelTracker.resolve(key, command) === "accept") {
        acceptedPositions.push(position);
        acceptedColors.push(
          command.metadata.colors[index]
        );
        this.#pixelTracker.record(key, command);
      }
    });

    if (acceptedPositions.length === 0) {
      return;
    }

    const acceptedCommand: PixelSelectEditCommand = {
      ...command,
      metadata: {
        positions: acceptedPositions,
        colors: acceptedColors
      }
    };

    applyCommandToBuffer(
      this.buffer,
      acceptedCommand
    );
    context.room.broadcast({
      type: "command",
      data: acceptedCommand
    });
  }

  /**
   * Resolves per-face like strokes (all-or-nothing: any key rejection blocks the whole command).
   */
  #receiveUvRegionCommand(
    cmd: PixelUvRegionCommand,
    context: network.RoomContext
  ): void {
    const keys = uvConflictKeys(cmd);
    const rejected = keys.some(
      (key) => this.#regionTracker.resolve(key, cmd) === "reject"
    );
    if (rejected) {
      return;
    }

    for (const key of keys) {
      this.#regionTracker.record(key, cmd);
    }
    applyCommandToBuffer(
      this.buffer,
      cmd
    );
    context.room.broadcast({
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
      uvRegions: [
        ...this.buffer.uvRegions
      ].map((region) => region.toJSON())
    };
  }
}
