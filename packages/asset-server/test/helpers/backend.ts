// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  AssetProjector,
  AssetStateStore,
  AssetWriter,
  CatalogIdentitySidecar,
  Reconciler,
  ReconciliationWatcher,
  MemoryAssetSource,
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
