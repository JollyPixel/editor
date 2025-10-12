// Import Internal Dependencies
import { Asset } from "./Base.js";

export class AssetQueue {
  #assets: Asset[] = [];

  get size() {
    return this.#assets.length;
  }

  enqueue(
    asset: Asset
  ) {
    this.#assets.push(asset);
  }

  dequeueAll(): Asset[] {
    const assets = [...this.#assets];
    this.#assets = [];

    return assets;
  }
}
