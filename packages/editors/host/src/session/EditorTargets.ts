// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type { LaunchNavigator } from "../launch/LaunchNavigator.ts";

export type EditorTargetsEvents = {
  change: () => void;
};

export interface EditorTargetsCatalog extends Pick<CatalogClient, "records"> {
  subscribe(
    type: "change",
    listener: () => void
  ): () => void;
}

export interface EditorTargetsOptions {
  catalog: EditorTargetsCatalog;
  accepts: string;
  current: string;
  navigator: LaunchNavigator;
}

export class EditorTargets extends Emitter<EditorTargetsEvents> {
  readonly accepts: string;
  readonly current: string;

  readonly #catalog: EditorTargetsCatalog;
  readonly #navigator: LaunchNavigator;
  readonly #unsubscribe: () => void;

  constructor(
    options: EditorTargetsOptions
  ) {
    super();

    this.accepts = options.accepts;
    this.current = options.current;
    this.#catalog = options.catalog;
    this.#navigator = options.navigator;
    this.#unsubscribe = this.#catalog.subscribe(
      "change",
      () => this.emit("change")
    );
  }

  * [Symbol.iterator](): IterableIterator<AssetRecordData> {
    const records = [...this.#catalog.records()]
      .filter((record) => record.kind === this.accepts)
      .sort((left, right) => left.source.localeCompare(right.source));

    yield* records;
  }

  async open(
    assetId: string
  ): Promise<void> {
    if (assetId !== this.current) {
      await this.#navigator.navigate(assetId, null);
    }
  }

  dispose(): void {
    this.#unsubscribe();
  }
}
