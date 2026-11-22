// Import Third-party Dependencies
import { AssetLoaderRegistry } from "@jolly-pixel/asset";
import type * as THREE from "three/webgpu";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  SoundAssetLoader,
  SoundAssetType
} from "./loaders/SoundAssetLoader.ts";
import {
  FontAssetLoader,
  FontAssetType
} from "./loaders/FontAssetLoader.ts";
import {
  ModelAssetLoader,
  ModelAssetType
} from "./loaders/ModelAssetLoader.ts";
import {
  JSONFileAssetLoader,
  SceneFileAssetType
} from "./loaders/JSONFileAssetLoader.ts";
import {
  TEXTURE_ASSET,
  TextureAssetLoader,
  type CompressedTextureLoader
} from "./loaders/TextureAssetLoader.ts";

export type ThreeAssetLoaderDefinition<
  TValue = unknown
> = Systems.AssetLoaderDefinition<THREE.LoadingManager, TValue>;

export interface DefaultAssetLoadersOptions {
  /**
   * Loads `.ktx2` texture sources.
   */
  ktx2?: CompressedTextureLoader;
  /**
   * Registered after the built-in loaders, each built with the same manager.
   * A kind the built-in loaders already handle throws.
   */
  loaders?: Iterable<ThreeAssetLoaderDefinition>;
}

export function createDefaultAssetLoaders(
  manager: THREE.LoadingManager,
  options: DefaultAssetLoadersOptions = {}
): AssetLoaderRegistry {
  const { ktx2, loaders = [] } = options;
  const registry = new AssetLoaderRegistry()
    .register(ModelAssetType, new ModelAssetLoader(manager))
    .register(SceneFileAssetType, new JSONFileAssetLoader(manager))
    .register(Systems.ENVIRONMENT_ASSET, new JSONFileAssetLoader(manager))
    .register(FontAssetType, new FontAssetLoader(manager))
    .register(SoundAssetType, new SoundAssetLoader(manager))
    .register(TEXTURE_ASSET, new TextureAssetLoader(manager, { ktx2 }));
  for (const definition of loaders) {
    registry.register(definition.type, definition.create(manager));
  }

  return registry;
}
