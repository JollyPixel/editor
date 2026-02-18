// Import Internal Dependencies
import { Asset } from "./Base.ts";

export class AssetQueue {
  #assets: Asset[] = [];
  #pendingPaths = new Set<string>();

  get size() {
    return this.#assets.length;
  }

  enqueue(
    asset: Asset
  ): boolean {
    const path = asset.toString();
    if (this.#pendingPaths.has(path)) {
      return false;
    }

    this.#assets.push(asset);
    this.#pendingPaths.add(path);

    return true;
  }

  dequeueAll(): Asset[] {
    const assets = [...this.#assets];
    this.#assets = [];
    this.#pendingPaths.clear();

    return assets;
  }
}
