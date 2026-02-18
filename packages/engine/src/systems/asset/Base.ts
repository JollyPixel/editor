// Import Internal Dependencies
import { parse } from "../../utils/path.ts";

export type AssetTypeName =
  | "unknown"
  | "model"
  | "font"
  | "tilemap"
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

  get longExt() {
    const basename = this.basename;
    const firstDotIndex = basename.indexOf(".");

    return firstDotIndex === -1 ?
      "" :
      basename.slice(firstDotIndex);
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
