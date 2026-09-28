// Import Third-party Dependencies
import { AssetLoaderRegistry } from "@jolly-pixel/asset";
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  AUDIO_ASSET,
  AudioAssetLoader
} from "./audio.ts";
import {
  FontAssetLoader,
  FontAssetType
} from "./font.ts";
import {
  ModelAssetLoader,
  ModelAssetType
} from "./model.ts";
import {
  TEXTURE_ASSET,
  TextureAssetLoader
} from "./texture.ts";

export function createDefaultAssetLoaders(
  manager: THREE.LoadingManager
): AssetLoaderRegistry {
  return new AssetLoaderRegistry()
    .register(ModelAssetType, new ModelAssetLoader(manager))
    .register(FontAssetType, new FontAssetLoader(manager))
    .register(AUDIO_ASSET, new AudioAssetLoader(manager))
    .register(TEXTURE_ASSET, new TextureAssetLoader(manager));
}
