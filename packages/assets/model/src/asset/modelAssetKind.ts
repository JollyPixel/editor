// Import Third-party Dependencies
import {
  binaryAssetKind,
  binaryCommands,
  MAX_KIND_CONTENT_BYTES,
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

// CONSTANTS
const kBytesPerMb = 1024 * 1024;
const kDefaultMaxFileMb = 64;
const kOptionsSchema = z.strictObject({
  maxFileMb: z.optional(z.int().check(
    z.minimum(1),
    z.maximum(MAX_KIND_CONTENT_BYTES / kBytesPerMb),
    z.meta({
      title: "Max file size (MB)",
      default: kDefaultMaxFileMb
    })
  ))
});

export type ModelAssetKindOptions = z.infer<typeof kOptionsSchema>;

export function modelAssetKind(
  options: ModelAssetKindOptions = {}
): AssetKindHandler<BinaryAssetState, never> {
  const { maxFileMb = kDefaultMaxFileMb } = options;

  return {
    ...binaryAssetKind,
    kind: MODEL_KIND,
    extensions: MODEL_EXTENSIONS,
    maxContentBytes: maxFileMb * kBytesPerMb,
    commands: binaryCommands(MODEL_COMMAND, { compress: true })
  };
}

export const ASSET_KINDS: AssetKindPackage<ModelAssetKindOptions> = {
  descriptors: [MODEL_ASSET],
  optionsSchema: kOptionsSchema,
  handlers: (options) => [modelAssetKind(options)]
};
