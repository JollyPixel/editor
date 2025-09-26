// Import Internal Dependencies
import { parse } from "../../utils/path.js";

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

  toString() {
    return this.path + this.basename;
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
