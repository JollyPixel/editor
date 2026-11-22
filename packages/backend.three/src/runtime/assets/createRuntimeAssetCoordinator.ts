// Import Third-party Dependencies
import {
  AssetCoordinator,
  type AssetCatalog
} from "@jolly-pixel/asset";
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import { createDefaultAssetLoaders } from "../../assets/createDefaultAssetLoaders.ts";
import type { CompressedTextureLoader } from "../../assets/texture.ts";
import type {
  ThreeAssetLoaderDefinition
} from "./RuntimeAssetOptions.ts";

export interface RuntimeAssetCoordinatorOptions {
  loaders?: Iterable<ThreeAssetLoaderDefinition>;
  ktx2?: CompressedTextureLoader;
}

export function createRuntimeAssetCoordinator(
  manager: THREE.LoadingManager,
  catalog: AssetCatalog,
  options: RuntimeAssetCoordinatorOptions = {}
): AssetCoordinator {
  const {
    loaders: definitions = [],
    ktx2
  } = options;

  const loaders = createDefaultAssetLoaders(manager, {
    ktx2
  });
  for (const definition of definitions) {
    loaders.register(
      definition.type,
      definition.create(manager)
    );
  }

  return new AssetCoordinator({
    catalog,
    loaders
  });
}
