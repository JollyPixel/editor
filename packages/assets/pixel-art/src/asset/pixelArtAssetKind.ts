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
import {
  PIXEL_ART_COMMAND,
  PIXEL_ART_EXTENSION,
  PIXEL_ART_KIND
} from "./kind.ts";
import type { PixelNetworkCommand } from "../network/types.ts";

// CONSTANTS
const kDefaultSize: Vec2 = {
  x: 32,
  y: 32
};

export interface PixelArtAssetKindOptions {
  defaultSize?: Vec2;
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver;
}

export function pixelArtAssetKind(
  options: PixelArtAssetKindOptions = {}
): AssetKindHandler<PixelArtState, PixelNetworkCommand> {
  const {
    defaultSize = kDefaultSize,
    snapshot,
    conflictResolver
  } = options;

  return {
    kind: PIXEL_ART_KIND,
    extensions: {
      [PIXEL_ART_EXTENSION]: "application/json; charset=utf-8"
    },
    snapshot,

    create(): PixelArtState {
      return new PixelArtState(defaultSize);
    },

    load(
      state: PixelArtState,
      content: Uint8Array
    ): void {
      state.load(
        decodePixelArtDocument(content)
      );
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
        applyCommandToBuffer(
          state.buffer,
          command
        );
      },

      live({ state }) {
        const arbiter = new PixelCommandArbiter({
          conflictResolver
        });

        return {
          snapshotSchema: pixelSnapshotSchema,
          snapshot: () => pixelArtSnapshot(state.buffer),
          arbitrate: (command) => arbiter.admit(state.buffer, command)
        };
      }
    }
  };
}
