// Import Third-party Dependencies
import { bytesSchema } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  AssetCommands,
  AssetKindHandler
} from "../AssetKindHandler.ts";
import { contentRefSchema } from "../ContentRef.ts";
import { PASS_THROUGH_BUILD } from "../authoring/passThroughBuild.ts";
import { readOnlyCommands } from "../authoring/readOnlyCommands.ts";

// CONSTANTS
const kBytesOrRefSchema = z.union([
  bytesSchema,
  contentRefSchema
]);

export const BINARY_KIND = "binary";

export interface BinaryAssetState {
  bytes: Uint8Array;
}

export const binaryAssetKind: AssetKindHandler<BinaryAssetState> = {
  kind: BINARY_KIND,
  build: PASS_THROUGH_BUILD,
  extensions: {},

  create(): BinaryAssetState {
    return {
      bytes: new Uint8Array()
    };
  },

  load(
    state: BinaryAssetState,
    content: Uint8Array
  ): void {
    state.bytes = content;
  },

  clear(
    state: BinaryAssetState
  ): void {
    state.bytes = new Uint8Array();
  },

  serialize(
    state: BinaryAssetState
  ): Promise<Uint8Array> {
    return Promise.resolve(
      state.bytes
    );
  }
};

export interface BinaryCommandsOptions {
  /**
   * Deflates the snapshot bytes on sockets that negotiated compression.
   * Worth it for content that shrinks, such as glTF; PNG or Ogg does not.
   * @default false
   */
  readonly compress?: boolean;
  /**
   * Sends content larger than this many bytes as a content ref the client
   * fetches over HTTP, when the backend serves refs; `compress` then lets the
   * route compress it. Content at or below it goes out inline.
   */
  readonly refAbove?: number;
}

export function binaryCommands(
  eventType: string,
  options: BinaryCommandsOptions = {}
): AssetCommands<BinaryAssetState, never> {
  const { compress, refAbove } = options;

  return readOnlyCommands({
    eventType,
    snapshotSchema: refAbove === undefined ? bytesSchema : kBytesOrRefSchema,
    compressSnapshot: compress,
    snapshot: (state) => state.bytes,
    encodeSnapshot: refAbove === undefined ?
      undefined :
      ({ state, contentRef }) => (
        contentRef === undefined || state.bytes.byteLength <= refAbove ?
          Promise.resolve(null) :
          contentRef(state.bytes, { compress })
      )
  });
}
