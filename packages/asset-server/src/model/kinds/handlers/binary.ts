// Import Third-party Dependencies
import { bytesSchema } from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AssetCommands,
  AssetKindHandler
} from "../AssetKindHandler.ts";
import { readOnlyCommands } from "../readOnlyCommands.ts";

export const BINARY_KIND = "binary";

export interface BinaryAssetState {
  bytes: Uint8Array;
}

export const binaryAssetKind: AssetKindHandler<BinaryAssetState> = {
  kind: BINARY_KIND,
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
}

export function binaryCommands(
  eventType: string,
  options: BinaryCommandsOptions = {}
): AssetCommands<BinaryAssetState, never> {
  return readOnlyCommands({
    eventType,
    snapshotSchema: bytesSchema,
    compressSnapshot: options.compress,
    snapshot: (state) => state.bytes
  });
}
