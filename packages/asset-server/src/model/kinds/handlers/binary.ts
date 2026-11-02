// Import Internal Dependencies
import type {
  AssetCommands,
  AssetKindHandler
} from "../AssetKindHandler.ts";
import { readOnlyCommands } from "../readOnlyCommands.ts";
import { assetInlineContentSchema } from "../../events/AssetEvents.schema.ts";
import { encodeContent } from "../../events/inlineContent.ts";

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

export function binaryCommands(
  eventType: string
): AssetCommands<BinaryAssetState, never> {
  return readOnlyCommands({
    eventType,
    snapshotSchema: assetInlineContentSchema,
    snapshot: (state) => encodeContent(state.bytes)
  });
}
