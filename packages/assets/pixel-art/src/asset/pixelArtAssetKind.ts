// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import {
  InvalidAssetDocumentError,
  type AssetKindHandler,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import {
  decodePixelArtDocument,
  deserializePixelBuffer,
  encodePixelArtDocument,
  InvalidPixelArtDocumentError,
  pixelArtSnapshot,
  PixelBuffer,
  serializePixelBuffer,
  type PixelArtDocumentData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PIXEL_ART_COMMAND,
  PIXEL_ART_EXTENSION,
  PIXEL_ART_KIND
} from "./pixelArt.ts";
import { applyCommandToBuffer } from "../network/PixelCommandApplier.ts";
import { encodePixelSnapshot } from "../network/PixelSnapshotCodec.ts";
import {
  pixelCommandProtocol,
  pixelSnapshotSchema
} from "../network/PixelCommand.schema.ts";
import { PixelCommandArbiter } from "../network/PixelCommandArbiter.ts";
import { correctPixelCommand } from "../network/PixelCorrection.ts";
import type { PixelWireCommand } from "../network/types.ts";

// CONSTANTS
const kDefaultSize: Vec2 = {
  x: 32,
  y: 32
};

export class PixelArtState {
  readonly buffer: PixelBuffer;

  constructor(
    size: Vec2
  ) {
    this.buffer = new PixelBuffer({
      size
    });
  }

  toJSON(): PixelArtDocumentData {
    return serializePixelBuffer(this.buffer);
  }

  load(
    document: PixelArtDocumentData
  ): void {
    deserializePixelBuffer(
      document,
      this.buffer
    );
  }

  clear(): void {
    const size = this.buffer.size();

    this.buffer.replacePixels(
      new Uint8ClampedArray(size.x * size.y * 4),
      size
    );
    this.buffer.uvRegions.clear();
  }
}

export interface PixelArtAssetKindOptions {
  defaultSize?: Vec2;
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver;
}

export function pixelArtAssetKind(
  options: PixelArtAssetKindOptions = {}
): AssetKindHandler<PixelArtState, PixelWireCommand> {
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
      try {
        state.load(
          decodePixelArtDocument(content)
        );
      }
      catch (error) {
        if (error instanceof InvalidPixelArtDocumentError) {
          throw new InvalidAssetDocumentError(
            PIXEL_ART_KIND,
            "content is not a valid pixel-art document",
            { cause: error }
          );
        }

        throw error;
      }
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
          encodeSnapshot: () => encodePixelSnapshot(state.buffer),
          arbitrate: (command) => arbiter.admit(state.buffer, command),
          correct: (command, admitted) => correctPixelCommand(
            state.buffer,
            command,
            admitted
          ),
          restore: (command, version) => arbiter.restore(command, version)
        };
      }
    }
  };
}
