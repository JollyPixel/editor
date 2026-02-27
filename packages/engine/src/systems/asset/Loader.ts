// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  Asset,
  type AssetTypeName
} from "./Base.ts";

export type AssetLoaderContext = {
  manager: THREE.LoadingManager;
};

export type AssetLoaderCallback<TReturn = unknown, TOptions = unknown> = (
  asset: Asset<TReturn, TOptions>,
  context: AssetLoaderContext,
  options?: TOptions
) => Promise<TReturn>;

export class AssetLoader<TReturn = unknown, TOptions = unknown> {
  readonly type: AssetTypeName;
  readonly extensions: ReadonlyArray<string>;
  readonly load: AssetLoaderCallback<TReturn, TOptions>;

  constructor(options: {
    type: AssetTypeName;
    extensions: Iterable<string>;
    load: AssetLoaderCallback<TReturn, TOptions>;
  }) {
    this.type = options.type;
    this.extensions = [...options.extensions];
    this.load = options.load;
  }
}
