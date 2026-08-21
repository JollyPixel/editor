// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type * as network from "@jolly-pixel/network";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  decodeContent,
  isAssetEvent,
  type AssetKindHandler,
  type AssetRoomBinding,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { applyCommandToBuffer } from "../network/PixelCommandApplier.ts";
import { isPixelNetworkCommand } from "../network/PixelCommandValidator.ts";
import {
  createPixelArtBuffer,
  decodePixelArtDocument,
  encodePixelArtDocument,
  loadPixelArtDocument
} from "./PixelArtDocument.ts";
import { PixelArtAssetExtension } from "./PixelArtAssetExtension.ts";
import type { PixelArtState } from "./PixelArtState.ts";
import type { Vec2 } from "../types.ts";

export const PIXEL_ART_KIND = "pixelart";
export const PIXEL_ART_COMMAND = "pixelart.command";

// CONSTANTS
const kDefaultMatch = ["**/*.pixelart"] as const;
const kDefaultSize: Vec2 = {
  x: 32,
  y: 32
};

export interface PixelArtAssetHandlerOptions {
  /**
   * Globs claiming pixel-art documents.
   * @default ["**\/*.pixelart"]
   */
  match?: readonly string[];
  /**
   * Size of a buffer with no content yet, before its first document lands.
   * @default 32x32
   */
  defaultSize?: Vec2;
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver;
}

/**
 * Uses `apply` as the sole writer to keep live state consistent with replay.
 */
export function pixelArtAssetHandler(
  options: PixelArtAssetHandlerOptions = {}
): AssetKindHandler<PixelArtState> {
  const {
    match = kDefaultMatch,
    defaultSize = kDefaultSize,
    snapshot,
    conflictResolver
  } = options;

  return {
    kind: PIXEL_ART_KIND,
    match,
    snapshot,

    create(): PixelArtState {
      return { buffer: createPixelArtBuffer(defaultSize) };
    },

    apply(
      state: PixelArtState,
      event: EventStore.Event
    ): void {
      // Ignore malformed events to retain the last valid replay state.
      try {
        applyEvent(state, event, defaultSize);
      }
      catch (error) {
        console.error(
          `pixelArtAssetHandler: skipped malformed event (eventType="${event.eventType}"):`,
          error
        );
      }
    },

    serialize(
      state: PixelArtState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodePixelArtDocument(state.buffer)
      );
    },

    createExtension(
      binding: AssetRoomBinding<PixelArtState>
    ) {
      return new PixelArtAssetExtension(binding, {
        commandEventType: PIXEL_ART_COMMAND,
        conflictResolver
      });
    }
  };
}

function applyEvent(
  state: PixelArtState,
  event: EventStore.Event,
  defaultSize: Vec2
): void {
  if (isAssetEvent(event)) {
    if (
      event.eventType === ASSET_CREATED ||
      event.eventType === ASSET_UPDATED
    ) {
      loadPixelArtDocument(
        state.buffer,
        decodePixelArtDocument(
          decodeContent(event.eventData.content)
        )
      );
    }
    else if (event.eventType === ASSET_DELETED) {
      state.buffer.replacePixels(
        new Uint8ClampedArray(defaultSize.x * defaultSize.y * 4),
        defaultSize
      );
      state.buffer.uvRegions.clear();
    }

    return;
  }

  if (
    event.eventType === PIXEL_ART_COMMAND &&
    isPixelNetworkCommand(event.eventData)
  ) {
    applyCommandToBuffer(
      state.buffer,
      event.eventData
    );
  }
}
