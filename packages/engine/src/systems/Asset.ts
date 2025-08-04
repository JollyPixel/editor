// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { parse } from "../utils/path.js";

export type AssetTypeName =
  | "unknown"
  | "texture"
  | "audio"
  | "model"
  | (string & {});

export class Asset {
  id = globalThis.crypto.randomUUID();

  name: string;
  ext: string;
  path: string;
  type: AssetTypeName;

  constructor(
    path: string,
    type?: AssetTypeName
  ) {
    const { dir, name, ext } = parse(path);

    this.name = name;
    this.path = dir;
    this.ext = ext;
    this.type = type ?? "unknown";
  }

  get basename() {
    return this.name + this.ext;
  }

  static from(
    assetOrPath: Asset | string
  ): Asset {
    if (assetOrPath instanceof Asset) {
      return assetOrPath;
    }

    return new Asset(assetOrPath);
  }
}

export interface LazyAsset<T = unknown> {
  asset: Asset;
  get: () => T;
}

export type AssetLoaderContext = {
  manager: THREE.LoadingManager;
};
export type AssetLoaderCallback<T = unknown> = (asset: Asset, context: AssetLoaderContext) => Promise<T>;

export interface AssetLoaderOptions {
  extensions: Iterable<string>;
  type: AssetTypeName;
}

export class AssetManager extends EventTarget {
  toBeLoaded: Asset[] = [];

  extToLoader: Map<string, string> = new Map();

  assets: Map<string, unknown> = new Map();
  loaders: Map<string, AssetLoaderCallback> = new Map();

  registerLoader<T = unknown>(
    options: AssetLoaderOptions,
    loader: AssetLoaderCallback<T>
  ): (assetOrPath: Asset | string) => LazyAsset<T> {
    this.loaders.set(options.type, loader);
    for (const ext of options.extensions) {
      this.extToLoader.set(ext, options.type);
    }

    return (assetOrPath) => this.load<T>(assetOrPath);
  }

  load<T = unknown>(
    assetOrPath: Asset | string
  ): LazyAsset<T> {
    const asset = Asset.from(assetOrPath);
    if (asset.type === "unknown") {
      asset.type = this.extToLoader.get(asset.ext) ?? "unknown";
    }

    this.toBeLoaded.push(asset);
    this.dispatchEvent(new CustomEvent("asset:load", {
      detail: asset
    }));

    return {
      asset,
      get: () => this.get<T>(asset.id)
    };
  }

  get<T>(
    id: string
  ): T {
    if (this.assets.has(id)) {
      return this.assets.get(id) as T;
    }

    throw new Error(`Asset with id ${id} not found.`);
  }

  async loadAll(
    context: AssetLoaderContext
  ): Promise<void> {
    if (this.toBeLoaded.length === 0) {
      return;
    }

    try {
      await Promise.all(this.toBeLoaded.map(async(asset) => {
        const loader = this.loaders.get(asset.type);
        if (!loader) {
          throw new Error(`No loader registered for asset type: ${asset.type}`);
        }

        const result = await loader(asset, context);
        this.assets.set(asset.id, result);
      }));
    }
    finally {
      this.toBeLoaded = [];
    }
  }
}
