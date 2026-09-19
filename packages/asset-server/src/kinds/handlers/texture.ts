// Import Internal Dependencies
import type { AssetKindHandler } from "../AssetKindHandler.ts";
import {
  binaryAssetKind,
  type BinaryAssetState
} from "./binary.ts";

export const TEXTURE_KIND = "texture";

// CONSTANTS
const kExtensions: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp"
};

export interface TextureAssetKindOptions {
  /**
   * Globs narrowing the claimed image paths.
   */
  match?: readonly string[];
}

export function textureAssetKind(
  options: TextureAssetKindOptions = {}
): AssetKindHandler<BinaryAssetState> {
  return {
    ...binaryAssetKind,
    kind: TEXTURE_KIND,
    extensions: kExtensions,
    match: options.match
  };
}
