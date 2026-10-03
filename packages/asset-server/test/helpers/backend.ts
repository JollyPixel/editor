// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  AssetWriter,
  CatalogFolders,
  type ArchiveBackend,
  type AssetKindHandler,
  type CatalogBackend,
  type CatalogProjection,
  type SnapshotPolicy
} from "#src/index.ts";
import { IdentitySidecar } from "#src/identity/index.ts";
import {
  AssetProjector,
  ProjectionState
} from "#src/projection/index.ts";
import {
  AssetStateStore,
  SnapshotScheduler
} from "#src/state/index.ts";
import {
  Reconciler,
  SourceWatcher
} from "#src/reconcile/index.ts";

export interface SyncHarness extends AsyncDisposable {
  readonly source: MemoryAssetSource;
  readonly eventStore: EventStore.EventStore;
  readonly state: ProjectionState;
  readonly projector: AssetProjector;
  readonly states: AssetStateStore;
  readonly scheduler: SnapshotScheduler;
  readonly writer: AssetWriter;
  readonly reconciler: Reconciler;
  readonly watcher: SourceWatcher;
  readonly identity: IdentitySidecar;
  readonly kinds: AssetKindRegistry;
}

export interface SyncHarnessOptions {
  handlers?: AssetKindHandler[];
  snapshot?: SnapshotPolicy;
  source?: MemoryAssetSource;
  eventStore?: EventStore.EventStore;
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
    list: (...parameters) => count(store.reader.list(...parameters)),
    listFromCheckpoint: (...parameters) => count(
      store.reader.listFromCheckpoint(...parameters)
    ),
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
      subscribe: (listener, options) => store.subscribe(listener, options),
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
  const state = await ProjectionState.load(source);
  const projector = new AssetProjector({ source, eventStore, state });
  projector.load();
  projector.start();

  const states = new AssetStateStore({ eventStore, kinds });
  states.start();

  const identity = await IdentitySidecar.load(source);
  const writer = new AssetWriter({
    eventStore,
    kinds,
    projector,
    identity
  });

  const scheduler = new SnapshotScheduler({
    eventStore,
    states,
    projector,
    writer,
    snapshot: options.snapshot
  });
  scheduler.start();

  const reconciler = new Reconciler({
    source,
    projector,
    writer
  });
  const watcher = new SourceWatcher({
    source,
    onChange: async(changed) => {
      if (changed.has("file")) {
        await reconciler.reconcile();
      }
    },
    debounce: 100
  });

  return {
    source,
    eventStore,
    state,
    projector,
    states,
    scheduler,
    writer,
    reconciler,
    watcher,
    identity,
    kinds,
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
    async flush(assetId) {
      await sync.scheduler.flush(assetId);
      await sync.projector.flush(assetId);
    }
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
      flush: () => backend.flush()
    })
  };
}
