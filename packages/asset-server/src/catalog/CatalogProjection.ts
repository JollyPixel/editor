// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  AssetCatalog,
  AssetId,
  AssetRecord,
  type AssetManifestData,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CatalogChange } from "./client/protocol.ts";
import {
  DependencyIndex,
  type DependencyMap
} from "./client/DependencyIndex.ts";
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_EVENT_PREFIX,
  ASSET_RENAMED,
  ASSET_UPDATED,
  parseAssetEvent,
  type AssetEvent
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
  #unindexed = new Set<string>();
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

  get size(): number {
    return this.#catalog.size;
  }

  load(): void {
    this.#catalog = new AssetCatalog();
    this.#dependencies.clear();
    this.#unindexed.clear();
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

  dependencies(): DependencyMap {
    return this.#dependencies.toJSON();
  }

  dependenciesOf(
    assetId: string
  ): readonly AssetReferenceData[] {
    return this.#dependencies.dependenciesOf(assetId);
  }

  dependentsOf(
    assetId: string
  ): readonly string[] {
    return this.#dependencies.dependentsOf(assetId);
  }

  closureOf(
    assetId: string
  ): AssetReferenceData[] {
    return this.#dependencies.closureOf(assetId);
  }

  dependenciesFirst(
    starts: Iterable<AssetReferenceData>
  ): AssetReferenceData[] {
    return this.#dependencies.dependenciesFirst(starts);
  }

  unindexed(): IterableIterator<string> {
    return this.#unindexed.values();
  }

  #fold(
    event: AssetEvent
  ): CatalogChange | null {
    const id = new AssetId(event.assetId);

    switch (event.eventType) {
      case ASSET_CREATED:
      case ASSET_UPDATED: {
        const data = event.eventData;
        const record = new AssetRecord({
          id,
          kind: data.kind,
          source: data.path,
          revision: data.hash
        });
        if (data.dependencies === undefined) {
          this.#unindexed.add(event.assetId);
        }
        else {
          this.#unindexed.delete(event.assetId);
          this.#dependencies.set(event.assetId, data.dependencies);
        }

        return this.#upsert(record, event.eventType);
      }
      case ASSET_RENAMED: {
        const data = event.eventData;
        const previous = this.#catalog.has(id) ?
          this.#catalog.get(id) :
          null;

        const record = new AssetRecord({
          id,
          kind: previous?.kind ?? data.kind,
          source: data.to,
          revision: previous?.revision ?? data.hash
        });

        return this.#upsert(record, event.eventType);
      }
      case ASSET_DELETED: {
        if (!this.#catalog.has(id)) {
          return null;
        }

        this.#catalog.remove(id);
        this.#dependencies.delete(event.assetId);
        this.#unindexed.delete(event.assetId);

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
    eventType: string
  ): CatalogChange {
    if (this.#catalog.has(record.id)) {
      this.#catalog.replace(record);
    }
    else {
      this.#catalog.add(record);
    }

    const assetId = record.id.value;
    if (!this.#dependencies.has(assetId)) {
      return {
        eventType,
        assetId,
        record: record.toJSON()
      };
    }

    return {
      eventType,
      assetId,
      record: record.toJSON(),
      dependencies: this.#dependencies.dependenciesOf(assetId)
    };
  }
}
