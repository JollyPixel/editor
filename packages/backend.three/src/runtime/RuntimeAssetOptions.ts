// Import Third-party Dependencies
import type {
  RuntimeAssetCatalog
} from "@jolly-pixel/runtime";

// Import Internal Dependencies
import type {
  ThreeAssetLoaderDefinition
} from "../assets/createDefaultAssetLoaders.ts";

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
