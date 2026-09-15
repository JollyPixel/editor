// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetKindHandler,
  SnapshotPolicy
} from "@jolly-pixel/asset-server/kinds";
import {
  decodePixelArtDocument,
  encodePixelArtDocument,
  pixelArtSnapshot,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyCommandToBuffer } from "../network/PixelCommandApplier.ts";
import {
  pixelCommandProtocol,
  pixelSnapshotSchema
} from "../network/PixelCommand.schema.ts";
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
  match?: readonly string[];
  defaultSize?: Vec2;
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver;
}

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

    load(
      state: PixelArtState,
      content: Uint8Array
    ): void {
      state.load(decodePixelArtDocument(content));
    },

    clear(
      state: PixelArtState
    ): void {
      state.clear();
    },

    serialize(
      state: PixelArtState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        encodePixelArtDocument(state.toJSON())
      );
    },

    commands: {
      eventType: PIXEL_ART_COMMAND,
      protocol: pixelCommandProtocol,

      apply(state, command) {
        applyCommandToBuffer(state.buffer, command);
      },

      live({ state }) {
        const arbiter = new PixelCommandArbiter({ conflictResolver });

        return {
          snapshotSchema: pixelSnapshotSchema,
          snapshot: () => pixelArtSnapshot(state.buffer),
          arbitrate: (command) => arbiter.admit(state.buffer, command)
        };
      }
    }
  };
}
