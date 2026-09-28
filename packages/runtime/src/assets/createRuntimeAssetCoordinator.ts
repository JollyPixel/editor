// Import Third-party Dependencies
import {
  AssetCoordinator,
  type AssetCatalog
} from "@jolly-pixel/asset";
import { createDefaultAssetLoaders } from "@jolly-pixel/engine";
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import type {
  RuntimeAssetLoaderDefinition
} from "./RuntimeAssetOptions.ts";

export function createRuntimeAssetCoordinator(
  manager: THREE.LoadingManager,
  catalog: AssetCatalog,
  definitions: Iterable<RuntimeAssetLoaderDefinition> = []
): AssetCoordinator {
  const loaders = createDefaultAssetLoaders(manager);
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
