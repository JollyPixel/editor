// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetId,
  AssetRecord,
  type AssetManifestData
} from "@jolly-pixel/asset";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CatalogChange } from "./client/protocol.ts";
import {
  DependencyIndex,
  type ReadonlyDependencyIndex
} from "./client/DependencyIndex.ts";
import type {
  AssetProjectionChange,
  AssetProjector
} from "../projection/AssetProjector.ts";
import type { AssetProjection } from "../projection/applyProjection.ts";

export type CatalogProjectionEventMap = {
  changed: (
    change: CatalogChange
  ) => void;
};

export interface CatalogProjectionOptions {
  projector: AssetProjector;
}

export class CatalogProjection extends Emitter<
  CatalogProjectionEventMap
> {
  #projector: AssetProjector;
  #catalog = new AssetCatalog();
  #dependencies = new DependencyIndex();
  #following = false;

  constructor(
    options: CatalogProjectionOptions
  ) {
    super();
    this.#projector = options.projector;
  }

  get catalog(): AssetCatalog {
    return this.#catalog;
  }

  get dependencies(): ReadonlyDependencyIndex {
    return this.#dependencies;
  }

  get size(): number {
    return this.#catalog.size;
  }

  load(): void {
    this.#catalog = new AssetCatalog();
    this.#dependencies.clear();
    for (const { assetId, projection } of this.#projector.desiredProjections()) {
      this.#upsert(assetId, projection);
    }
  }

  start(): void {
    if (!this.#following) {
      this.#following = true;
      this.#projector.on("changed", this.#onProjected);
    }
  }

  close(): void {
    this.#following = false;
    this.#projector.off("changed", this.#onProjected);
    this.removeAllListeners();
  }

  record(
    assetId: string
  ): AssetRecord | undefined {
    return this.#catalog.find(assetId);
  }

  snapshot(): AssetManifestData {
    return this.#catalog.toJSON();
  }

  dependentsOf(
    assetId: string
  ): AssetRecord[] {
    return this.#dependencies
      .dependentsOf(assetId)
      .flatMap((dependentId) => this.record(dependentId) ?? []);
  }

  * unindexed(): IterableIterator<AssetRecord> {
    for (const record of this.#catalog) {
      if (!this.#dependencies.has(record.id.value)) {
        yield record;
      }
    }
  }

  readonly #onProjected = (
    change: AssetProjectionChange
  ): void => {
    const catalogChange = this.#fold(change);
    if (catalogChange !== null) {
      this.emit("changed", catalogChange);
    }
  };

  #fold(
    change: AssetProjectionChange
  ): CatalogChange | null {
    const { assetId, eventType, desired } = change;
    if (desired === null) {
      const id = new AssetId(assetId);
      if (!this.#catalog.has(id)) {
        return null;
      }

      this.#catalog.remove(id);
      this.#dependencies.delete(assetId);

      return {
        eventType,
        assetId,
        record: null
      };
    }

    const record = this.#upsert(assetId, desired);

    return {
      eventType,
      assetId,
      record: record.toJSON(),
      ...(this.#dependencies.has(assetId) ?
        { dependencies: this.#dependencies.dependenciesOf(assetId) } :
        {})
    };
  }

  #upsert(
    assetId: string,
    projection: AssetProjection
  ): AssetRecord {
    const record = new AssetRecord({
      id: new AssetId(assetId),
      kind: projection.kind,
      source: projection.path,
      revision: projection.hash
    });
    this.#catalog.set(record);
    if (projection.dependencies !== undefined) {
      this.#dependencies.set(assetId, projection.dependencies);
    }

    return record;
  }
}
