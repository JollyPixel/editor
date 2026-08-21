// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import type { AssetRoomBinding } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { PixelCommandArbiter } from "../network/PixelCommandArbiter.ts";
import {
  isPixelNetworkAction,
  isPixelNetworkCommand,
  PIXEL_NETWORK_ACTIONS
} from "../network/PixelCommandValidator.ts";
import { pixelArtSnapshot } from "./PixelArtDocument.ts";
import type { PixelArtState } from "./PixelArtState.ts";

export interface PixelArtAssetExtensionOptions {
  commandEventType: string;
  /**
   * Conflict resolver (defaults to LastWriteWinsResolver).
   */
  conflictResolver?: network.ConflictResolver;
}

/**
 * Appends accepted commands for the asset state store to apply.
 */
export class PixelArtAssetExtension extends network.Extension {
  readonly id: string;
  readonly name: string;
  readonly events = PIXEL_NETWORK_ACTIONS;

  #assetId: string;
  #state: PixelArtState;
  #commandEventType: string;
  #arbiter: PixelCommandArbiter;

  constructor(
    binding: AssetRoomBinding<PixelArtState>,
    options: PixelArtAssetExtensionOptions
  ) {
    super();

    this.id = binding.roomId;
    this.name = binding.kind;
    this.#assetId = binding.assetId;
    this.#state = binding.state;
    this.#commandEventType = options.commandEventType;
    this.#arbiter = new PixelCommandArbiter({
      conflictResolver: options.conflictResolver
    });
  }

  onClientConnect(
    client: network.ClientHandle
  ): void {
    client.send({
      type: "snapshot",
      data: pixelArtSnapshot(this.#state.buffer)
    });
  }

  onClientDisconnect(
    _clientId: string
  ): void {
    // The room owns client-list bookkeeping.
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

  async onMessage(
    clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): Promise<void> {
    if (!isPixelNetworkCommand(payload)) {
      return;
    }

    const accepted = this.#arbiter.accept(this.#state.buffer, {
      ...payload,
      clientId
    });
    if (accepted === null) {
      return;
    }

    // Append applies the event before peers receive it.
    const appended = await context.eventStore.append({
      assetType: this.name,
      assetId: this.#assetId,
      eventType: this.#commandEventType,
      eventData: accepted
    });
    if (!appended) {
      return;
    }

    context.room.broadcast({
      type: "command",
      data: accepted
    });
  }
}
