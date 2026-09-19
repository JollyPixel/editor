// Import Internal Dependencies
import type { AssetKindHandler } from "../AssetKindHandler.ts";

export const BINARY_KIND = "binary";

export interface BinaryAssetState {
  bytes: Uint8Array;
}

/**
 * Fallback handler that treats an asset's bytes as its state.
 */
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
