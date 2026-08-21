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
  isPixelNetworkAction,
  isPixelNetworkCommand,
  PIXEL_NETWORK_ACTIONS
} from "./PixelCommandValidator.ts";
import {
  PixelCommandArbiter
} from "./PixelCommandArbiter.ts";
import {
  PixelBuffer
} from "../buffer/PixelBuffer.ts";
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand
} from "./types.ts";

export type {
  PixelSelectEditCommand,
  PixelStrokeCommand,
  PixelUvRegionCommand
} from "./PixelCommandArbiter.ts";

export type ClientHandle = network.ClientHandle;

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
 * Owns one buffer and applies accepted commands to it directly.
 * Persistent hosts append commands accepted by `PixelCommandArbiter`.
 */
export class PixelSyncServer extends network.Extension {
  readonly id: string;
  readonly name = "pixel-draw.renderer";
  readonly events = PIXEL_NETWORK_ACTIONS;
  readonly buffer: PixelBuffer;

  #arbiter: PixelCommandArbiter;

  constructor(
    options: PixelSyncServerOptions = {}
  ) {
    super();

    this.id = options.id ?? "pixel-draw";
    this.buffer = options.buffer ?? new PixelBuffer({
      size: { x: 1, y: 1 }
    });
    this.#arbiter = new PixelCommandArbiter({
      conflictResolver: options.conflictResolver
    });
  }

  onClientConnect(
    client: network.ClientHandle
  ): void {
    client.send({
      type: "snapshot",
      data: this.snapshot()
    });
  }

  onClientDisconnect(
    _clientId: string
  ): void {
    // The room owns client-list bookkeeping.
  }

  onMessage(
    clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): void {
    if (!isPixelNetworkCommand(payload)) {
      return;
    }

    try {
      this.receive({
        ...payload,
        clientId
      }, context);
    }
    catch (error) {
      if (error instanceof RangeError) {
        return;
      }

      throw error;
    }
  }

  override getEventName(
    payload: unknown
  ): string {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "action" in payload &&
      isPixelNetworkAction(payload.action)
    ) {
      return payload.action;
    }

    return "invalid";
  }

  receive(
    command: PixelNetworkCommand,
    context: network.RoomContext
  ): void {
    const accepted = this.#arbiter.accept(this.buffer, command);
    if (accepted === null) {
      return;
    }

    applyCommandToBuffer(
      this.buffer,
      accepted
    );
    context.room.broadcast({
      type: "command",
      data: accepted
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
