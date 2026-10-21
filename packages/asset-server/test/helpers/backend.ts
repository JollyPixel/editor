// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  AssetTags,
  AssetWriter,
  CatalogFolders,
  type ArchiveBackend,
  type AnyAssetKindHandler,
  type CatalogBackend,
  type CatalogProjection,
  type SnapshotPolicy
} from "#src/index.ts";
import { AssetIndex } from "#src/storage/AssetIndex.ts";
import { AssetBackups } from "#src/storage/AssetBackups.ts";
import { AssetPartFiles } from "#src/storage/AssetPartFiles.ts";
import {
  AssetProjector,
  ProjectionState
} from "#src/storage/projection/index.ts";
import { AssetStateStore } from "#src/live/AssetStateStore.ts";
import { SnapshotScheduler } from "#src/live/SnapshotScheduler.ts";
import {
  Reconciler,
  SourceWatcher
} from "#src/storage/reconcile/index.ts";

export interface SyncHarness extends AsyncDisposable {
  readonly source: MemoryAssetSource;
  readonly eventStore: EventStore.EventStore;
  readonly state: ProjectionState;
  readonly backups: AssetBackups;
  readonly projector: AssetProjector;
  readonly states: AssetStateStore;
  readonly scheduler: SnapshotScheduler;
  readonly writer: AssetWriter;
  readonly reconciler: Reconciler;
  readonly watcher: SourceWatcher;
  readonly assetIndex: AssetIndex;
  readonly kinds: AssetKindRegistry;
  flush(assetId?: string): Promise<void>;
}

export interface SyncHarnessOptions {
  handlers?: AnyAssetKindHandler[];
  snapshot?: SnapshotPolicy;
  source?: MemoryAssetSource;
  eventStore?: EventStore.EventStore;
  compact?: boolean;
}

export interface ReadCounter {
  readonly store: EventStore.EventStore;
  readonly read: number;
  reset(): void;
}

export function countingReads(
  store: EventStore.EventStore
): ReadCounter {
  let read = 0;

  const reader: EventStore.EventReader = {
    get: (...parameters) => {
      const event = store.reader.get(...parameters);
      if (event !== undefined) {
        read++;
      }

      return event;
    },
    list: (...parameters) => count(store.reader.list(...parameters)),
    listAll: (...parameters) => count(store.reader.listAll(...parameters)),
    listFromCheckpoints: (...parameters) => count(
      store.reader.listFromCheckpoints(...parameters)
    )
  };

  function count(
    events: EventStore.Event[]
  ): EventStore.Event[] {
    read += events.length;

    return events;
  }

  return {
    store: {
      writer: store.writer,
      reader,
      tags: store.tags,
      subscribe: (listener, options) => store.subscribe(listener, options),
      subscribeRejections: (listener) => store.subscribeRejections(listener),
      compact: (options) => store.compact(options),
      close: () => store.close(),
      [Symbol.dispose]: () => store.close()
    },
    get read() {
      return read;
    },
    reset() {
      read = 0;
    }
  };
}

export async function syncHarness(
  options: SyncHarnessOptions = {}
): Promise<SyncHarness> {
  const source = options.source ?? new MemoryAssetSource();
  const ownsEventStore = options.eventStore === undefined;
  const eventStore = options.eventStore ?? EventStore.persistence.memory();
  const kinds = new AssetKindRegistry(options.handlers ?? []);
  const partFiles = new AssetPartFiles(kinds);
  const state = await ProjectionState.load(source);
  const backups = new AssetBackups(source);
  const projector = new AssetProjector({
    source,
    eventStore,
    state,
    backups,
    partFiles
  });
  projector.load();
  projector.start();

  const states = new AssetStateStore({ eventStore, kinds });
  states.start();

  const assetIndex = await AssetIndex.load(source);
  const writer = new AssetWriter({
    eventStore,
    kinds,
    projector,
    assetIndex
  });

  const scheduler = new SnapshotScheduler({
    eventStore,
    states,
    kinds,
    projector,
    writer,
    snapshot: options.snapshot,
    compact: options.compact
  });
  scheduler.start();

  const reconciler = new Reconciler({
    source,
    projector,
    writer,
    partFiles
  });
  const watcher = new SourceWatcher({
    source,
    onChange: async(files) => {
      if (files.size > 0) {
        await reconciler.reconcile(files);
      }
    },
    debounce: 100
  });

  return {
    source,
    eventStore,
    state,
    backups,
    projector,
    states,
    scheduler,
    writer,
    reconciler,
    watcher,
    assetIndex,
    kinds,
    async flush(assetId) {
      await scheduler.flush(assetId);
      await projector.flush(assetId);
    },
    async [Symbol.asyncDispose]() {
      await watcher.close();
      await scheduler.close();
      await projector.close();
      states.close();
      if (ownsEventStore) {
        eventStore.close();
      }
    }
  };
}

export function archiveBackend(
  sync: SyncHarness,
  catalog: CatalogProjection
): ArchiveBackend {
  return {
    source: sync.source,
    kinds: sync.kinds,
    writer: sync.writer,
    catalog,
    flush: (assetId) => sync.flush(assetId)
  };
}

export function catalogBackend(
  sync: SyncHarness,
  catalog: CatalogProjection
): CatalogBackend {
  const backend = archiveBackend(sync, catalog);

  return {
    ...backend,
    folders: new CatalogFolders({
      source: sync.source,
      catalog,
      flush: () => backend.flush(),
      kinds: sync.kinds
    }),
    tags: new AssetTags({
      eventStore: sync.eventStore,
      projector: sync.projector,
      writer: sync.writer,
      flush: (assetId) => backend.flush(assetId),
      backups: sync.backups
    })
  };
}
