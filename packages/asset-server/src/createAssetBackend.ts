// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { Server } from "@jolly-pixel/network";
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  STATE_GITIGNORE_CONTENT,
  STATE_GITIGNORE_PATH
} from "./stateDirectory.ts";
import type { AssetEventDataMap } from "./events/AssetEvents.ts";
import { IdentitySidecar } from "./identity/IdentitySidecar.ts";
import { AssetKindRegistry } from "./kinds/AssetKindRegistry.ts";
import type {
  AssetKindHandler,
  SnapshotPolicy
} from "./kinds/AssetKindHandler.ts";
import { ProjectionState } from "./projection/ProjectionState.ts";
import { AssetProjector } from "./projection/AssetProjector.ts";
import { AssetStateStore } from "./state/AssetStateStore.ts";
import { AssetWriter } from "./writer/AssetWriter.ts";
import { SnapshotScheduler } from "./state/SnapshotScheduler.ts";
import { Reconciler } from "./reconcile/Reconciler.ts";
import { ReconciliationWatcher } from "./reconcile/ReconciliationWatcher.ts";
import { CatalogProjection } from "./catalog/CatalogProjection.ts";
import { CatalogExtension } from "./catalog/CatalogExtension.ts";
import { backfillDependencies } from "./catalog/backfillDependencies.ts";
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
  /**
   * Decoded size cap of a catalog payload: created content and archives.
   * @default DEFAULT_CATALOG_MAX_CONTENT_BYTES
   */
  catalogMaxContentBytes?: number;
  logger?: Logger;
}

/**
 * Internal stages exposed to tests, tooling, and hosts.
 *
 * They stay outside `AssetBackend` because their shapes are not public API.
 */
export interface AssetBackendInternals {
  readonly identity: IdentitySidecar;
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
    catalogMaxContentBytes,
    logger = silentLogger()
  } = options;

  function onAppend(
    event: EventStore.Event
  ): void {
    logger
      .withMetadata({
        assetType: event.assetType,
        assetId: event.assetId,
        eventType: event.eventType,
        eventVersion: event.eventVersion
      })
      .debug("append event");
  }
  function onAppendError(
    error: Error,
    input: EventStore.AppendInput
  ): void {
    logger
      .withMetadata({
        assetType: input.assetType,
        assetId: input.assetId,
        eventType: input.eventType,
        reason: error.message,
        outcome: "failed"
      })
      .error("append event");
  }
  eventStore.writer.on("append", onAppend);
  eventStore.writer.on("error", onAppendError);

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
    kinds,
    logger
  });
  states.start();

  const identity = await IdentitySidecar.load(source, logger);
  const writer = new AssetWriter({
    eventStore,
    kinds,
    projector,
    identity,
    logger
  });

  const scheduler = new SnapshotScheduler({
    eventStore,
    states,
    projector,
    writer,
    snapshot,
    logger
  });
  scheduler.start();

  const reconciler = new Reconciler({
    source,
    projector,
    writer,
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
  const backfilled = await backfillDependencies({
    catalog,
    kinds,
    projector,
    writer,
    logger
  });
  if (backfilled > 0) {
    logger
      .withMetadata({ assets: backfilled })
      .info("asset dependencies backfilled");
  }
  async function flush(
    assetId?: string
  ): Promise<void> {
    await scheduler.flush(assetId);
    await projector.flush(assetId);
  }

  const catalogExtension = new CatalogExtension({
    projection: catalog,
    writer,
    archive: {
      source,
      kinds,
      writer,
      catalog,
      flush
    },
    maxContentBytes: catalogMaxContentBytes
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

    flush,

    attach(server, attachOptions = {}) {
      server.register(catalogExtension);

      return registerAssetRooms({
        server,
        events: eventStore.writer,
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
      eventStore.writer.off("append", onAppend);
      eventStore.writer.off("error", onAppendError);
    },

    async [Symbol.asyncDispose]() {
      await backend.close();
    }
  };

  return backend;
}
