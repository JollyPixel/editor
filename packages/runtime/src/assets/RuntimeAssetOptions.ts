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
  readonly ktx2?: RuntimeKTX2Options;
}

export interface RuntimeKTX2Options {
  /**
   * URL of the directory serving `basis_transcoder.js` and
   * `basis_transcoder.wasm`, copied from `three/examples/jsm/libs/basis/`.
   */
  readonly transcoderPath: string;
}

export interface RuntimeAssetLoaderDefinition<
  TValue = unknown
> {
  readonly type: AssetType<TValue>;
  create(
    manager: THREE.LoadingManager
  ): AssetLoader<TValue>;
}
