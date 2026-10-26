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
import { retainedPartEvents } from "./model/events/retainedPartEvents.ts";
import { AssetIndex } from "./storage/AssetIndex.ts";
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
import type { ReconcileReport } from "./storage/reconcile/Reconciler.ts";
import {
  SourceSync,
  type ReconcilePolicy
} from "./storage/reconcile/SourceSync.ts";
import { traceAppends } from "./storage/traceAppends.ts";
import { CatalogProjection } from "./catalog/CatalogProjection.ts";
import { CatalogFolders } from "./catalog/CatalogFolders.ts";
import {
  CatalogExtension,
  type CatalogBackend,
  type CatalogPolicy
} from "./catalog/CatalogExtension.ts";
import { backfillDependencies } from "./catalog/backfillDependencies.ts";
import { registerAssetRooms } from "./live/registerAssetRooms.ts";
import { AssetTags } from "./catalog/tags/AssetTags.ts";
import { AssetBackups } from "./storage/AssetBackups.ts";
import { Teardown } from "./common/Teardown.ts";
import { AssetPartFiles } from "./storage/AssetPartFiles.ts";
import {
  silentLogger,
  type Logger
} from "./common/logger.ts";

export interface CompactionPolicy {
  /**
   * Drops the events superseded by each asset's newest lifecycle checkpoint
   * before the projections load.
   *
   * Destructive and irreversible: it trades the editing history nothing
   * reads for a log that stops growing without bound.
   * @default false
   */
  onOpen?: boolean;
  /**
   * Drops the events superseded by an asset's newest lifecycle checkpoint
   * before each of its snapshots.
   * @default onOpen
   */
  onSnapshot?: boolean;
}

export interface AssetBackendTuning {
  /**
   * Default snapshot cadence, overridable per kind.
   */
  snapshot?: SnapshotPolicy;
  catalog?: CatalogPolicy;
  reconcile?: ReconcilePolicy;
  compaction?: CompactionPolicy;
  /**
   * Extra entries for the `.gitignore` of the state directory, relative to
   * that directory.
   */
  stateIgnores?: string[];
}

export interface AssetBackendOptions extends AssetBackendTuning {
  source: AssetSource;
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  /**
   * Kind handlers. The built-in `binary` fallback is always present and
   * claims whatever these do not.
   */
  handlers?: AnyAssetKindHandler[];
  logger?: Logger;
}

export interface AssetBackend extends CatalogBackend, AsyncDisposable {
  readonly eventStore: EventStore.TypedEventStore<AssetEventDataMap>;

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
  const teardown = new Teardown();
  try {
    return await assembleAssetBackend(options, teardown);
  }
  catch (error) {
    return teardown.unwind(error);
  }
}

async function assembleAssetBackend(
  options: AssetBackendOptions,
  teardown: Teardown
): Promise<AssetBackend> {
  const {
    source,
    eventStore,
    handlers = [],
    logger = silentLogger()
  } = options;
  const compactOnOpen = options.compaction?.onOpen ?? false;
  const compactOnSnapshot = options.compaction?.onSnapshot ?? compactOnOpen;

  teardown.defer(traceAppends(eventStore, logger));
  const kinds = new AssetKindRegistry(handlers);
  const partFiles = new AssetPartFiles(kinds);
  await ensureStateGitignore(source, options.stateIgnores);

  if (compactOnOpen) {
    const report = eventStore.compact({
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES,
      keep: retainedPartEvents(eventStore)
    });
    logger
      .withMetadata(report)
      .debug("event log compacted");
  }

  const state = eventStore.reader.listAll({ limit: 1 }).length === 0 ?
    new ProjectionState(source) :
    await ProjectionState.load(source, logger);
  const backups = new AssetBackups(source, logger);
  const projector = new AssetProjector({
    source,
    eventStore,
    state,
    backups,
    partFiles,
    logger
  });
  projector.load();
  projector.start();
  teardown.defer(() => projector.close());

  const catalog = new CatalogProjection({ projector });
  catalog.load();
  catalog.start();
  teardown.defer(() => catalog.close());

  const states = new AssetStateStore({
    eventStore,
    kinds,
    logger
  });
  states.start();
  teardown.defer(() => states.close());

  const writer = new AssetWriter({
    source,
    eventStore,
    kinds,
    projector,
    assetIndex: await AssetIndex.load(source, logger),
    logger
  });

  const scheduler = new SnapshotScheduler({
    eventStore,
    states,
    kinds,
    projector,
    writer,
    snapshot: options.snapshot,
    compact: compactOnSnapshot,
    logger
  });
  scheduler.start();
  teardown.defer(() => scheduler.close());

  async function flush(
    assetId?: string
  ): Promise<void> {
    await scheduler.flush(assetId);
    await projector.flush(assetId);
  }

  const tags = new AssetTags({
    eventStore,
    projector,
    writer,
    flush,
    backups,
    kinds,
    logger
  });

  const folders = new CatalogFolders({
    source,
    catalog,
    flush,
    kinds
  });
  teardown.defer(() => folders.close());

  const sync = new SourceSync({
    ...options.reconcile,
    source,
    projector,
    writer,
    afterPass: () => folders.refresh(),
    partFiles,
    logger
  });
  teardown.defer(() => sync.close());
  await sync.start();

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

  const backend: AssetBackend = {
    source,
    eventStore,
    kinds,
    writer,
    catalog,
    folders,
    tags,

    flush,
    reconcile: () => sync.reconcile(),

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

    close: () => teardown.run(),

    async [Symbol.asyncDispose]() {
      await backend.close();
    }
  };

  const catalogExtension = new CatalogExtension({
    ...options.catalog,
    backend
  });
  teardown.defer(() => catalogExtension.dispose());

  return backend;
}
