// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { Server } from "@jolly-pixel/network";
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  STATE_GITIGNORE_CONTENT,
  STATE_GITIGNORE_PATH
} from "./constants.ts";
import type { AssetEventDataMap } from "./events/AssetEvents.ts";
import { CatalogIdentitySidecar } from "./catalog/CatalogIdentitySidecar.ts";
import { AssetKindRegistry } from "./kinds/AssetKindRegistry.ts";
import type {
  AssetKindHandler,
  SnapshotPolicy
} from "./kinds/AssetKindHandler.ts";
import { ProjectionState } from "./sync/ProjectionState.ts";
import { AssetProjector } from "./sync/AssetProjector.ts";
import { AssetStateStore } from "./sync/AssetStateStore.ts";
import { AssetWriter } from "./sync/AssetWriter.ts";
import { SnapshotScheduler } from "./sync/SnapshotScheduler.ts";
import { Reconciler } from "./sync/Reconciler.ts";
import { ReconciliationWatcher } from "./sync/ReconciliationWatcher.ts";
import { CatalogProjection } from "./catalog/CatalogProjection.ts";
import { CatalogExtension } from "./catalog/CatalogExtension.ts";
import { registerAssetRooms } from "./rooms/registerAssetRooms.ts";
import {
  silentLogger,
  type Logger
} from "./logger.ts";

export interface AssetBackendOptions {
  source: AssetSource;
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  /**
   * Kind handlers. The built-in `binary` fallback is always present and
   * claims whatever these do not.
   */
  handlers?: AssetKindHandler[];
  /**
   * Default snapshot cadence, overridable per kind.
   */
  snapshot?: SnapshotPolicy;
  /**
   * Reconcile the physical store on startup.
   * @default true
   */
  reconcileOnStart?: boolean;
  /**
   * Watch the source for external changes, when it supports it.
   * @default true
   */
  watch?: boolean;
  /**
   * Quiet period, in milliseconds, before filesystem notifications become
   * one reconciliation pass.
   */
  reconcileDebounce?: number;
  logger?: Logger;
}

/**
 * Internal stages exposed to tests, tooling, and hosts.
 *
 * They stay outside `AssetBackend` because their shapes are not public API.
 */
export interface AssetBackendInternals {
  readonly identity: CatalogIdentitySidecar;
  readonly state: ProjectionState;
  readonly projector: AssetProjector;
  readonly states: AssetStateStore;
  readonly scheduler: SnapshotScheduler;
  readonly reconciler: Reconciler;
  readonly watcher: ReconciliationWatcher;
  readonly catalogExtension: CatalogExtension;
}

export interface AssetBackend extends AsyncDisposable {
  readonly source: AssetSource;
  readonly eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  readonly kinds: AssetKindRegistry;
  readonly writer: AssetWriter;
  readonly catalog: CatalogProjection;
  readonly internals: AssetBackendInternals;

  flush(
    assetId?: string
  ): Promise<void>;

  attach(
    server: Server,
    options?: { graceMs?: number; }
  ): () => void;

  close(): Promise<void>;
}

/**
 * Assembles the asset backend and starts projections in dependency order.
 */
export async function createAssetBackend(
  options: AssetBackendOptions
): Promise<AssetBackend> {
  const {
    source,
    eventStore,
    handlers = [],
    snapshot,
    reconcileOnStart = true,
    watch = true,
    reconcileDebounce,
    logger = silentLogger()
  } = options;

  const kinds = new AssetKindRegistry(handlers);
  await source.writeIfAbsent(
    STATE_GITIGNORE_PATH,
    new TextEncoder().encode(STATE_GITIGNORE_CONTENT)
  );

  const state = await ProjectionState.load(source, logger);
  const projector = new AssetProjector({
    source,
    eventStore,
    state,
    logger
  });
  projector.load();
  projector.start();

  const states = new AssetStateStore({
    eventStore,
    kinds
  });
  states.start();

  const scheduler = new SnapshotScheduler({
    eventStore,
    states,
    projector,
    snapshot,
    logger
  });
  scheduler.start();

  const identity = await CatalogIdentitySidecar.load(source, logger);
  const writer = new AssetWriter({
    eventStore,
    kinds,
    projector,
    identity,
    source,
    logger
  });

  const reconciler = new Reconciler({
    source,
    projector,
    writer,
    kinds,
    logger
  });
  const watcher = new ReconciliationWatcher({
    source,
    reconciler,
    debounce: reconcileDebounce,
    logger
  });

  const catalog = new CatalogProjection({ eventStore });

  if (reconcileOnStart) {
    (await reconciler.reconcile()).orTee((error) => logger
      .withMetadata({ reason: error.message })
      .error("initial reconciliation failed"));
    await projector.flush();
  }

  catalog.load();
  catalog.start();
  const catalogExtension = new CatalogExtension({
    projection: catalog
  });

  if (watch) {
    watcher.start();
  }

  const backend: AssetBackend = {
    source,
    eventStore,
    kinds,
    writer,
    catalog,
    internals: {
      identity,
      state,
      projector,
      states,
      scheduler,
      reconciler,
      watcher,
      catalogExtension
    },

    async flush(assetId) {
      await scheduler.flush(assetId);
      await projector.flush(assetId);
    },

    attach(server, attachOptions = {}) {
      server.register(catalogExtension);

      return registerAssetRooms({
        server,
        kinds,
        catalog,
        states,
        projector,
        scheduler,
        graceMs: attachOptions.graceMs,
        logger
      });
    },

    async close() {
      await watcher.close();
      await scheduler.close();
      await projector.close();
      states.close();
      catalogExtension.dispose();
      catalog.close();
    },

    async [Symbol.asyncDispose]() {
      await backend.close();
    }
  };

  return backend;
}
