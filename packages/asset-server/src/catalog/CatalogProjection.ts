// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
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
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_EVENT_PREFIX,
  ASSET_RENAMED,
  ASSET_UPDATED,
  parseAssetEvent,
  type AssetEvent,
  type AssetEventType
} from "../events/AssetEvents.ts";

export type CatalogProjectionEventMap = {
  changed: (
    change: CatalogChange
  ) => void;
};

export interface CatalogProjectionOptions {
  eventStore: EventStore.EventStore;
}

export class CatalogProjection extends Emitter<
  CatalogProjectionEventMap
> {
  #eventStore: EventStore.EventStore;
  #catalog = new AssetCatalog();
  #dependencies = new DependencyIndex();
  #unsubscribe: (() => void) | null = null;

  constructor(
    options: CatalogProjectionOptions
  ) {
    super();
    this.#eventStore = options.eventStore;
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
    const events = this.#eventStore.reader.listFromCheckpoints({
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES,
      eventTypePrefix: ASSET_EVENT_PREFIX
    });
    for (const event of events) {
      this.apply(event);
    }
  }

  start(): void {
    this.#unsubscribe ??= this.#eventStore.subscribe(
      (event) => void this.apply(event),
      { eventTypePrefix: ASSET_EVENT_PREFIX }
    );
  }

  close(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.removeAllListeners();
  }

  apply(
    event: EventStore.Event
  ): boolean {
    const parsed = parseAssetEvent(event);
    if (!parsed.ok) {
      return false;
    }

    const change = this.#fold(parsed.val);
    if (change === null) {
      return false;
    }

    this.emit("changed", change);

    return true;
  }

  record(
    assetId: string
  ): AssetRecord | undefined {
    const id = new AssetId(assetId);

    return this.#catalog.has(id) ? this.#catalog.get(id) : undefined;
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

  #fold(
    event: AssetEvent
  ): CatalogChange | null {
    const id = new AssetId(event.assetId);

    switch (event.eventType) {
      case ASSET_CREATED:
      case ASSET_UPDATED: {
        const data = event.eventData;
        if (data.dependencies !== undefined) {
          this.#dependencies.set(event.assetId, data.dependencies);
        }

        return this.#upsert(new AssetRecord({
          id,
          kind: data.kind,
          source: data.path,
          revision: data.hash
        }), event.eventType);
      }
      case ASSET_RENAMED: {
        const data = event.eventData;
        const previous = this.record(event.assetId);

        return this.#upsert(new AssetRecord({
          id,
          kind: previous?.kind ?? data.kind,
          source: data.to,
          revision: previous?.revision ?? data.hash
        }), event.eventType);
      }
      case ASSET_DELETED: {
        if (!this.#catalog.has(id)) {
          return null;
        }

        this.#catalog.remove(id);
        this.#dependencies.delete(event.assetId);

        return {
          eventType: event.eventType,
          assetId: event.assetId,
          record: null
        };
      }
      default:
        return null;
    }
  }

  #upsert(
    record: AssetRecord,
    eventType: AssetEventType
  ): CatalogChange {
    if (this.#catalog.has(record.id)) {
      this.#catalog.replace(record);
    }
    else {
      this.#catalog.add(record);
    }

    const assetId = record.id.value;
    const change: CatalogChange = {
      eventType,
      assetId,
      record: record.toJSON()
    };

    return this.#dependencies.has(assetId) ?
      {
        ...change,
        dependencies: this.#dependencies.dependenciesOf(assetId)
      } :
      change;
  }
}
