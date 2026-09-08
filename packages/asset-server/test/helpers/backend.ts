// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  AssetProjector,
  AssetStateStore,
  AssetWriter,
  CatalogIdentitySidecar,
  Reconciler,
  ReconciliationWatcher,
  ProjectionState,
  SnapshotScheduler,
  type AssetKindHandler,
  type SnapshotPolicy
} from "#src/index.ts";
import { manualTimers, type ManualTimers } from "./timers.ts";

export interface SyncHarness extends AsyncDisposable {
  readonly source: MemoryAssetSource;
  readonly eventStore: EventStore.EventStore;
  readonly state: ProjectionState;
  readonly projector: AssetProjector;
  readonly states: AssetStateStore;
  readonly scheduler: SnapshotScheduler;
  readonly writer: AssetWriter;
  readonly reconciler: Reconciler;
  readonly watcher: ReconciliationWatcher;
  readonly identity: CatalogIdentitySidecar;
  readonly kinds: AssetKindRegistry;
  readonly timers: ManualTimers;
}

export interface SyncHarnessOptions {
  handlers?: AssetKindHandler[];
  snapshot?: SnapshotPolicy;
  source?: MemoryAssetSource;
  eventStore?: EventStore.EventStore;
}

export interface ReadCounter {
  /** Stands in for the real store, counting what its reader hands out. */
  readonly store: EventStore.EventStore;
  /** Events returned by the reader since the last `reset`. */
  readonly read: number;
  reset(): void;
}

/**
 * Counts the events a reader materializes, so a test can pin that a
 * projection loads from the tail of the log instead of its whole history.
 */
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

/**
 * Wires source, state, projector and scheduler over in-memory backends,
 * with manual timers so nothing in the sync suite sleeps.
 */
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

  const timers = manualTimers();
  const scheduler = new SnapshotScheduler({
    eventStore,
    states,
    projector,
    snapshot: options.snapshot,
    timers,
    now: () => timers.now
  });
  scheduler.start();

  const identity = await CatalogIdentitySidecar.load(source);
  const writer = new AssetWriter({
    eventStore,
    kinds,
    projector,
    identity,
    source
  });

  const reconciler = new Reconciler({
    source,
    projector,
    writer,
    kinds
  });
  const watcher = new ReconciliationWatcher({
    source,
    reconciler,
    timers,
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
    timers,
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
