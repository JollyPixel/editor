// Import Third-party Dependencies
import {
  binaryAssetKind,
  binaryCommands,
  type AssetKindHandler,
  type AssetKindPackage,
  type BinaryAssetState
} from "@jolly-pixel/asset-server";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  MODEL_ASSET,
  MODEL_COMMAND,
  MODEL_EXTENSIONS,
  MODEL_KIND
} from "./model.ts";

export function modelAssetKind(): AssetKindHandler<BinaryAssetState, never> {
  return {
    ...binaryAssetKind,
    kind: MODEL_KIND,
    extensions: MODEL_EXTENSIONS,
    commands: binaryCommands(MODEL_COMMAND)
  };
}

export const ASSET_KINDS: AssetKindPackage = {
  descriptors: [MODEL_ASSET],
  optionsSchema: z.strictObject({}),
  handlers: () => [modelAssetKind()]
};
