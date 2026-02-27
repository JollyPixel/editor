// Import Internal Dependencies
import { parse } from "../../utils/path.ts";

export type AssetTypeName =
  | "unknown"
  | "model"
  | "font"
  | "tilemap"
  | (string & {});

export class Asset<
  TReturn = unknown,
  TOptions = unknown
> {
  declare readonly _return: TReturn;
  declare readonly _options: TOptions;

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

  static from<TReturn = unknown, TOptions = unknown>(
    assetOrPath: Asset<TReturn, TOptions> | string
  ): Asset<TReturn, TOptions> {
    if (assetOrPath instanceof Asset) {
      return assetOrPath;
    }

    return new Asset<TReturn, TOptions>(assetOrPath);
  }
}

export interface LazyAsset<
  TReturn = unknown,
  TOptions = unknown
> {
  asset: Asset<TReturn, TOptions>;
  get: () => TReturn;
  getAsync: () => Promise<TReturn>;
}
