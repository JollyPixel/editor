// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { Server } from "@jolly-pixel/network";
import type { AssetSource } from "@jolly-pixel/asset-source";
import type { Result } from "@openally/result";

// Import Internal Dependencies
import { ensureStateGitignore } from "./stateDirectory.ts";
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
import {
  Reconciler,
  type ReconcileReport
} from "./reconcile/Reconciler.ts";
import { SourceWatcher } from "./reconcile/SourceWatcher.ts";
import { CatalogProjection } from "./catalog/CatalogProjection.ts";
import { CatalogFolders } from "./catalog/CatalogFolders.ts";
import { CatalogExtension } from "./catalog/CatalogExtension.ts";
import type { ArchiveLimits } from "./archive/ArchiveLimits.ts";
import { backfillDependencies } from "./reconcile/backfillDependencies.ts";
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
  /**
   * Decoded size caps of an archive the catalog plans or imports.
   */
  catalogArchiveLimits?: ArchiveLimits;
  /**
   * Refuse a catalog delete command aimed at an asset other assets still
   * reference. Reconciliation is never refused.
   * @default true
   */
  catalogDeleteProtection?: boolean;
  compactOnSnapshot?: boolean;
  logger?: Logger;
}

/**
 * The options a host may forward to `createAssetBackend` without owning its
 * source, event store, kinds or logger.
 */
export type AssetBackendTuning = Omit<
  AssetBackendOptions,
  "source" | "eventStore" | "handlers" | "logger"
>;

export interface AssetBackend extends AsyncDisposable {
  readonly source: AssetSource;
  readonly eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  readonly kinds: AssetKindRegistry;
  readonly writer: AssetWriter;
  readonly catalog: CatalogProjection;
  readonly folders: CatalogFolders;

  flush(
    assetId?: string
  ): Promise<void>;

  reconcile(): Promise<Result<ReconcileReport, Error>>;

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
    catalogArchiveLimits,
    catalogDeleteProtection,
    compactOnSnapshot = false,
    logger = silentLogger()
  } = options;

  function onAppend(
    event: EventStore.Event
  ): void {
    if (!logger.isLevelEnabled("debug")) {
      return;
    }

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
    if (input.expectedVersion !== undefined) {
      return;
    }

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
  await ensureStateGitignore(source);

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
    compact: compactOnSnapshot,
    logger
  });
  scheduler.start();

  const catalog = new CatalogProjection({ projector });
  const folders = new CatalogFolders({
    source,
    catalog,
    flush
  });

  const reconciler = new Reconciler({
    source,
    projector,
    writer,
    logger
  });
  const watcher = new SourceWatcher({
    source,
    onChange: onSourceChange,
    debounce: reconcileDebounce,
    logger
  });

  const booting = boot();
  try {
    await booting;
  }
  catch (error) {
    await watcher.close();
    throw error;
  }

  async function boot(): Promise<void> {
    if (watch) {
      await watcher.start();
    }
    if (reconcileOnStart) {
      (await reconciler.reconcile()).orTee(logReconcileFailure);
      await projector.flush();
    }

    catalog.load();
    catalog.start();
    await folders.refresh();
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
  }

  async function flush(
    assetId?: string
  ): Promise<void> {
    await scheduler.flush(assetId);
    await projector.flush(assetId);
  }

  async function reconcile(): Promise<Result<ReconcileReport, Error>> {
    const report = await reconciler.reconcile();
    await folders.refresh();

    return report;
  }

  async function onSourceChange(
    files: ReadonlySet<string>
  ): Promise<void> {
    await booting;
    if (files.size > 0) {
      (await reconciler.reconcile(files)).orTee(logReconcileFailure);
    }
    await folders.refresh();
  }

  function logReconcileFailure(
    error: Error
  ): void {
    logger
      .withMetadata({ reason: error.message })
      .error("reconciliation failed");
  }

  const catalogExtension = new CatalogExtension({
    backend: {
      source,
      kinds,
      writer,
      catalog,
      folders,
      flush
    },
    maxContentBytes: catalogMaxContentBytes,
    archiveLimits: catalogArchiveLimits,
    deleteProtection: catalogDeleteProtection
  });

  const backend: AssetBackend = {
    source,
    eventStore,
    kinds,
    writer,
    catalog,
    folders,

    flush,
    reconcile,

    attach(server, attachOptions = {}) {
      server.register(catalogExtension);

      return registerAssetRooms({
        server,
        events: eventStore.writer,
        reader: eventStore.reader,
        kinds,
        catalog,
        states,
        flush,
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
      folders.close();
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
