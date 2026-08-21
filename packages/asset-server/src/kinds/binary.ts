// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { AssetKindHandler } from "./AssetKindHandler.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  decodeContent,
  isAssetEvent
} from "../events/AssetEvents.ts";

export const BINARY_KIND = "binary";

export interface BinaryAssetState {
  bytes: Uint8Array;
}

/**
 * Fallback handler that treats an asset's bytes as its state.
 */
export const binaryAssetHandler: AssetKindHandler<BinaryAssetState> = {
  kind: BINARY_KIND,
  match: ["**/*"],

  create(): BinaryAssetState {
    return { bytes: new Uint8Array() };
  },

  apply(
    state: BinaryAssetState,
    event: EventStore.Event
  ): void {
    if (!isAssetEvent(event)) {
      return;
    }

    if (
      event.eventType === ASSET_CREATED ||
      event.eventType === ASSET_UPDATED
    ) {
      state.bytes = decodeContent(event.eventData.content);
    }
    else if (event.eventType === ASSET_DELETED) {
      state.bytes = new Uint8Array();
    }
  },

  serialize(
    state: BinaryAssetState
  ): Promise<Uint8Array> {
    return Promise.resolve(state.bytes);
  }
};
