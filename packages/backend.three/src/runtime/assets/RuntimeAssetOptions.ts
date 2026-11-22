// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/ecs";
import type * as THREE from "three/webgpu";
import type {
  RuntimeAssetCatalog
} from "@jolly-pixel/runtime";

export interface RuntimeAssetOptions {
  readonly catalog?: RuntimeAssetCatalog;
  readonly loaders?: Iterable<ThreeAssetLoaderDefinition>;
  readonly ktx2?: RuntimeKTX2Options;
}

export interface RuntimeKTX2Options {
  /**
   * URL of the directory serving `basis_transcoder.js` and
   * `basis_transcoder.wasm`, copied from `three/examples/jsm/libs/basis/`.
   */
  readonly transcoderPath: string;
}

export type ThreeAssetLoaderDefinition<
  TValue = unknown
> = Systems.AssetLoaderDefinition<THREE.LoadingManager, TValue>;
