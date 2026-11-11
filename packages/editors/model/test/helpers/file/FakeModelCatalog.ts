// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { ModelCatalog } from "#src/preview/ModelResources.ts";

type CatalogEvents = {
  change: () => void;
};

export class FakeModelCatalog implements ModelCatalog {
  #events = new Emitter<CatalogEvents>();
  #records = new Map<string, AssetRecordData>();
  #contents = new Map<string, Uint8Array>();

  add(
    path: string,
    content: Uint8Array,
    id = `asset-${this.#records.size + 1}`
  ): this {
    this.#records.set(id, {
      id,
      kind: "binary",
      path
    });
    this.#contents.set(id, content);
    this.#events.emit("change");

    return this;
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.#records.get(assetId);
  }

  records(): IterableIterator<AssetRecordData> {
    return this.#records.values();
  }

  async read(
    assetId: string
  ): Promise<Uint8Array> {
    const content = this.#contents.get(assetId);
    if (content === undefined) {
      throw new Error(`No content for asset "${assetId}".`);
    }

    return content;
  }

  async replace(): Promise<never> {
    throw new Error("FakeModelCatalog never replaces a file.");
  }

  subscribe(
    event: "change",
    listener: () => void
  ): () => void {
    return this.#events.subscribe(event, listener);
  }
}
