// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type * as network from "@jolly-pixel/network";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_UPDATED,
  decodeContent,
  parseAssetEvent,
  type AssetKindHandler,
  type AssetLiveProtocol,
  type AssetRoomBinding,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server/kinds";
import {
  decodePixelArtDocument,
  encodePixelArtDocument,
  pixelArtSnapshot,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyCommandToBuffer } from "../network/PixelCommandApplier.ts";
import { pixelProtocols } from "../network/PixelCommand.schema.ts";
import {
  isPixelNetworkCommand,
  satisfiesPixelDomainRules
} from "../network/PixelCommandValidator.ts";
import { PixelArtState } from "./PixelArtState.ts";
import { PixelCommandArbiter } from "../network/PixelCommandArbiter.ts";
import type { PixelNetworkCommand } from "../network/types.ts";

export const PIXEL_ART_KIND = "pixelart";
export const PIXEL_ART_COMMAND = "pixelart.command";

// CONSTANTS
const kDefaultMatch = ["**/*.pixelart"] as const;
const kContentTypes: Readonly<Record<string, string>> = {
  ".pixelart": "application/json; charset=utf-8"
};
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
): AssetKindHandler<PixelArtState, PixelNetworkCommand> {
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
    contentTypes: kContentTypes,

    create(): PixelArtState {
      return new PixelArtState(defaultSize);
    },

    apply(
      state: PixelArtState,
      event: EventStore.Event
    ): void {
      // Ignore malformed events to retain the last valid replay state.
      try {
        applyEvent(state, event);
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
        encodePixelArtDocument(state.toJSON())
      );
    },

    live(
      binding: AssetRoomBinding<PixelArtState>
    ): AssetLiveProtocol<PixelNetworkCommand> {
      const arbiter = new PixelCommandArbiter({ conflictResolver });
      const { state } = binding;

      return {
        commandEventType: PIXEL_ART_COMMAND,
        protocols: pixelProtocols,

        parse(payload) {
          return isPixelNetworkCommand(payload) &&
            satisfiesPixelDomainRules(payload) ? payload : null;
        },

        snapshot() {
          return pixelArtSnapshot(state.buffer);
        },

        arbitrate(command, clientId) {
          return arbiter.admit(state.buffer, {
            ...command,
            clientId
          });
        }
      };
    }
  };
}

function applyEvent(
  state: PixelArtState,
  event: EventStore.Event
): void {
  const parsed = parseAssetEvent(event);
  if (parsed.ok) {
    const assetEvent = parsed.val;
    if (
      assetEvent.eventType === ASSET_CREATED ||
      assetEvent.eventType === ASSET_UPDATED
    ) {
      state.load(
        decodePixelArtDocument(
          decodeContent(assetEvent.eventData.content)
        )
      );
    }
    else if (assetEvent.eventType === ASSET_DELETED) {
      state.clear();
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
