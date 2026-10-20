// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { Server } from "@jolly-pixel/network";
import type { AssetSource } from "@jolly-pixel/asset-source";
import type { Result } from "@openally/result";

// Import Internal Dependencies
import { ensureStateGitignore } from "./storage/stateDirectory.ts";
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  type AssetEventDataMap
} from "./model/events/AssetEvents.ts";
import { IdentitySidecar } from "./storage/IdentitySidecar.ts";
import { AssetKindRegistry } from "./model/kinds/AssetKindRegistry.ts";
import type {
  AnyAssetKindHandler,
  SnapshotPolicy
} from "./model/kinds/AssetKindHandler.ts";
import { ProjectionState } from "./storage/projection/ProjectionState.ts";
import { AssetProjector } from "./storage/projection/AssetProjector.ts";
import { AssetStateStore } from "./live/AssetStateStore.ts";
import { AssetWriter } from "./storage/writer/AssetWriter.ts";
import { SnapshotScheduler } from "./live/SnapshotScheduler.ts";
import {
  Reconciler,
  type ReconcileReport
} from "./storage/reconcile/Reconciler.ts";
import { SourceWatcher } from "./storage/reconcile/SourceWatcher.ts";
import { CatalogProjection } from "./catalog/CatalogProjection.ts";
import { CatalogFolders } from "./catalog/CatalogFolders.ts";
import { CatalogExtension } from "./catalog/CatalogExtension.ts";
import type { ArchiveLimits } from "./catalog/archive/ArchiveLimits.ts";
import { backfillDependencies } from "./catalog/backfillDependencies.ts";
import { registerAssetRooms } from "./live/registerAssetRooms.ts";
import { AssetTags } from "./catalog/tags/AssetTags.ts";
import { ContentObjects } from "./storage/ContentObjects.ts";
import {
  silentLogger,
  type Logger
} from "./common/logger.ts";

export interface AssetBackendOptions {
  source: AssetSource;
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  /**
   * Kind handlers. The built-in `binary` fallback is always present and
   * claims whatever these do not.
   */
  handlers?: AnyAssetKindHandler[];
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
  /**
   * Drops the events superseded by each asset's newest lifecycle checkpoint
   * before the projections load.
   * @default false
   */
  compactOnOpen?: boolean;
  compactOnSnapshot?: boolean;
  /**
   * Extra entries for the `.gitignore` of the state directory, relative to
   * that directory.
   */
  stateIgnores?: string[];
  logger?: Logger;
}

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
  readonly tags: AssetTags;

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
    compactOnOpen = false,
    compactOnSnapshot = false,
    stateIgnores = [],
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
  const unsubscribeAppend = eventStore.subscribe(onAppend);
  const unsubscribeAppendError = eventStore.subscribeRejections(onAppendError);

  const kinds = new AssetKindRegistry(handlers);
  await ensureStateGitignore(source, stateIgnores);

  if (compactOnOpen) {
    const report = eventStore.compact({
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES
    });
    logger
      .withMetadata(report)
      .debug("event log compacted");
  }

  const state = eventStore.reader.listAll({ limit: 1 }).length === 0 ?
    new ProjectionState(source) :
    await ProjectionState.load(source, logger);
  const objects = new ContentObjects(source, logger);
  const projector = new AssetProjector({
    source,
    eventStore,
    state,
    objects,
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
    kinds,
    projector,
    writer,
    snapshot,
    compact: compactOnSnapshot,
    logger
  });
  scheduler.start();

  const tags = new AssetTags({
    eventStore,
    projector,
    writer,
    flush,
    objects,
    logger
  });

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
      tags,
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
    tags,

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
        tags,
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
      unsubscribeAppend();
      unsubscribeAppendError();
    },

    async [Symbol.asyncDispose]() {
      await backend.close();
    }
  };

  return backend;
}
