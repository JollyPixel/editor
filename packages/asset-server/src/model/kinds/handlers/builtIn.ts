// Import Internal Dependencies
import type { AssetKindHandler } from "../AssetKindHandler.ts";
import {
  NO_OPTIONS_SCHEMA,
  type AssetKindPackage
} from "../AssetKindPackage.ts";
import { textureAssetKind } from "./texture.ts";
import { TEXTURE_ASSET } from "./textureAsset.ts";

export const BUILT_IN_KINDS_PACKAGE = "@jolly-pixel/asset-server";

export function builtInAssetKinds(): AssetKindHandler[] {
  return [
    textureAssetKind()
  ];
}

export const BUILT_IN_ASSET_KINDS: AssetKindPackage = {
  descriptors: [TEXTURE_ASSET],
  optionsSchema: NO_OPTIONS_SCHEMA,
  handlers: builtInAssetKinds
};
