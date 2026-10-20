// Import Internal Dependencies
import type { AssetKindHandler } from "../AssetKindHandler.ts";
import { textureAssetKind } from "./texture.ts";

export const BUILT_IN_KINDS_PACKAGE = "@jolly-pixel/asset-server";

export function builtInAssetKinds(): AssetKindHandler[] {
  return [
    textureAssetKind()
  ];
}
