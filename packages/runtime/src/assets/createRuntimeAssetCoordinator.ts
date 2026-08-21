// Import Third-party Dependencies
import {
  AssetCoordinator,
  AssetLoaderRegistry
} from "@jolly-pixel/asset";
import {
  AssetLoaders,
  AssetTypes,
  AUDIO_ASSET,
  AudioAssetLoader,
  TEXTURE_ASSET,
  TextureAssetLoader
} from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type {
  ResolvedRuntimeAssetOptions
} from "./RuntimeAssetOptions.ts";

/**
 * Composes the asset coordinator and default browser loaders used by Runtime.
 */
export function createRuntimeAssetCoordinator(
  manager: THREE.LoadingManager,
  options: ResolvedRuntimeAssetOptions
): AssetCoordinator {
  const loaders = new AssetLoaderRegistry()
    .register(
      AssetTypes.model,
      new AssetLoaders.model(manager)
    )
    .register(
      AssetTypes.font,
      new AssetLoaders.font(manager)
    )
    .register(
      AUDIO_ASSET,
      new AudioAssetLoader(manager)
    )
    .register(
      TEXTURE_ASSET,
      new TextureAssetLoader(manager)
    );

  for (const definition of options.loaders ?? []) {
    loaders.register(
      definition.type,
      definition.create(manager)
    );
  }

  return new AssetCoordinator({
    catalog: options.catalog,
    loaders
  });
}
