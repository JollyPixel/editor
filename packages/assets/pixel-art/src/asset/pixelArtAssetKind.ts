// Import Third-party Dependencies
import {
  InvalidAssetFileError,
  SNAPSHOT_POLICY_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import {
  decodePixelArtFile,
  deserializePixelDocument,
  encodePixelArtFile,
  InvalidPixelArtFileError,
  pixelArtSnapshot,
  PixelBuffer,
  PixelDocumentState,
  serializePixelDocument,
  type PixelArtFile,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  PIXEL_ART_ASSET,
  PIXEL_ART_COMMAND,
  PIXEL_ART_EXTENSION,
  PIXEL_ART_KIND,
  pixelArtContentFromPng
} from "./pixelArt.ts";
import { applyPixelCommand } from "../network/PixelCommandApplier.ts";
import { encodePixelSnapshot } from "../network/PixelSnapshotCodec.ts";
import {
  pixelCommandProtocol,
  pixelSnapshotSchema,
  sizeSchema
} from "../network/PixelCommand.schema.ts";
import { PixelCommandArbiter } from "../network/PixelCommandArbiter.ts";
import { correctPixelCommand } from "../network/PixelCorrection.ts";
import type { PixelWireCommand } from "../network/types.ts";

// CONSTANTS
const kDefaultSize: Vec2 = {
  x: 32,
  y: 32
};
const kOptionsSchema = z.strictObject({
  defaultSize: z.optional(
    sizeSchema.check(z.meta({ default: kDefaultSize }))
  ),
  snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
});

export class PixelArtState {
  readonly document: PixelDocumentState;

  constructor(
    size: Vec2
  ) {
    this.document = new PixelDocumentState({
      buffer: new PixelBuffer({
        size
      })
    });
  }

  toJSON(): PixelArtFile {
    return serializePixelDocument(this.document);
  }

  load(
    file: PixelArtFile
  ): void {
    deserializePixelDocument(
      file,
      this.document
    );
  }

  clear(): void {
    const { buffer } = this.document;
    const size = buffer.size();

    buffer.replacePixels(
      new Uint8ClampedArray(size.x * size.y * 4),
      size
    );
    this.document.uv.clear();
  }
}

export interface PixelArtAssetKindOptions {
  defaultSize?: Vec2;
  snapshot?: SnapshotPolicy;
}

export function pixelArtAssetKind(
  options: PixelArtAssetKindOptions = {}
): AssetKindHandler<PixelArtState, PixelWireCommand> {
  const {
    defaultSize = kDefaultSize,
    snapshot
  } = options;

  return {
    kind: PIXEL_ART_KIND,
    extensions: {
      [PIXEL_ART_EXTENSION]: "application/json; charset=utf-8"
    },
    conversions: {
      ".png": pixelArtContentFromPng
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
          decodePixelArtFile(content)
        );
      }
      catch (error) {
        if (error instanceof InvalidPixelArtFileError) {
          throw new InvalidAssetFileError(
            PIXEL_ART_KIND,
            "content is not a valid pixel-art file",
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
        encodePixelArtFile(state.toJSON())
      );
    },

    commands: {
      eventType: PIXEL_ART_COMMAND,
      protocol: pixelCommandProtocol,

      apply(state, command) {
        applyPixelCommand(
          state.document,
          command
        );
      },

      live({ state }) {
        const arbiter = new PixelCommandArbiter();

        return {
          snapshotSchema: pixelSnapshotSchema,
          snapshot: () => pixelArtSnapshot(state.document),
          encodeSnapshot: () => encodePixelSnapshot(state.document),
          arbitrate: (command) => arbiter.admit(state.document, command),
          correct: (command, admitted) => correctPixelCommand(
            state.document.buffer,
            command,
            admitted
          ),
          restore: (command, version) => arbiter.restore(command, version)
        };
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage<PixelArtAssetKindOptions> = {
  descriptors: [PIXEL_ART_ASSET],
  optionsSchema: kOptionsSchema,
  handlers: (options) => [pixelArtAssetKind(options)]
};
