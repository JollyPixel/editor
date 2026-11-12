// Import Internal Dependencies
import type { GolemAsset } from "../assets/GolemAsset.ts";

export type AssetHolder = string | symbol;

interface OpenedAsset {
  asset: GolemAsset;
  holders: Set<AssetHolder>;
}

export class OpenAssets {
  #opened = new Map<string, OpenedAsset>();

  get(
    assetId: string
  ): GolemAsset | undefined {
    return this.#opened.get(assetId)?.asset;
  }

  * values(): IterableIterator<GolemAsset> {
    for (const { asset } of this.#opened.values()) {
      yield asset;
    }
  }

  holds(
    assetId: string,
    holder: AssetHolder
  ): boolean {
    return this.#opened.get(assetId)?.holders.has(holder) ?? false;
  }

  hold(
    assetId: string,
    holder: AssetHolder,
    open: () => GolemAsset
  ): GolemAsset {
    let opened = this.#opened.get(assetId);
    if (opened === undefined) {
      opened = {
        asset: open(),
        holders: new Set()
      };
      this.#opened.set(assetId, opened);
    }
    opened.holders.add(holder);

    return opened.asset;
  }

  release(
    assetId: string,
    holder: AssetHolder
  ): void {
    const opened = this.#opened.get(assetId);
    if (opened?.holders.delete(holder) && opened.holders.size === 0) {
      opened.asset.close();
    }
  }

  forget(
    asset: GolemAsset
  ): void {
    this.#opened.delete(asset.id);
    for (const heldId of [...this.#opened.keys()]) {
      this.release(heldId, asset.id);
    }
  }
}
