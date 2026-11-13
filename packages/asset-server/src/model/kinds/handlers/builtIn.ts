// Import Internal Dependencies
import type { AssetKindHandler } from "../AssetKindHandler.ts";
import {
  NO_OPTIONS_SCHEMA,
  type AssetKindPackage
} from "../AssetKindPackage.ts";
import {
  textureAssetKind,
  TEXTURE_ASSET
} from "./texture.ts";

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
