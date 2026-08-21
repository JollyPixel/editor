// Import Internal Dependencies
import type { AssetKindHandler } from "./AssetKindHandler.ts";
import {
  binaryAssetHandler,
  type BinaryAssetState
} from "./binary.ts";

export const TEXTURE_KIND = "texture";

// CONSTANTS
const kDefaultMatch = [
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.webp",
  "**/*.gif",
  "**/*.bmp"
] as const;

export interface TextureAssetHandlerOptions {
  /**
   * Globs claiming texture paths.
   * @default png, jpg, jpeg, webp, gif and bmp anywhere under the root
   */
  match?: readonly string[];
}

/**
 * Registers image files under `texture` for matching runtime asset types.
 * State remains raw bytes and has no live editing room.
 */
export function textureAssetHandler(
  options: TextureAssetHandlerOptions = {}
): AssetKindHandler<BinaryAssetState> {
  return {
    ...binaryAssetHandler,
    kind: TEXTURE_KIND,
    match: options.match ?? kDefaultMatch
  };
}
