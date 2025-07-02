export interface AssetOptions {
  name: string;
  hash: string;
}

export class Asset {
  name: string;
  /**
   * SHA256 hash
   */
  hash: string;

  constructor(
    options: AssetOptions
  ) {
    this.name = options.name;
    this.hash = options.hash;
  }
}
