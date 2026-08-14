// Import Third-party Dependencies
import type {
  AssetCatalog,
  AssetLoader,
  AssetType
} from "@jolly-pixel/asset";
import type * as THREE from "three/webgpu";

export type RuntimeAssetCatalog = AssetCatalog | string | URL;

export interface RuntimeAssetOptions {
  readonly catalog?: RuntimeAssetCatalog;
  readonly loaders?: Iterable<RuntimeAssetLoaderDefinition>;
}

export interface RuntimeAssetLoaderDefinition<
  TValue = unknown
> {
  readonly type: AssetType<TValue>;
  create(
    manager: THREE.LoadingManager
  ): AssetLoader<TValue>;
}

export interface ResolvedRuntimeAssetOptions {
  readonly catalog: AssetCatalog;
  readonly loaders?: Iterable<RuntimeAssetLoaderDefinition>;
}
