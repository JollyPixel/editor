// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { Server } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetSource } from "./sources/AssetSource.ts";
import {
  STATE_GITIGNORE_CONTENT,
  STATE_GITIGNORE_PATH
} from "./constants.ts";
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
import type { Timers } from "./utils/timers.ts";
import { CatalogProjection } from "./catalog/CatalogProjection.ts";
import { CatalogExtension } from "./catalog/CatalogExtension.ts";
import { registerAssetRooms } from "./rooms/registerAssetRooms.ts";
import {
  silentLogger,
  type Logger
} from "./logger.ts";

export interface AssetBackendOptions {
  source: AssetSource;
  eventStore: EventStore.EventStore;
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
  timers?: Timers;
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
  readonly eventStore: EventStore.EventStore;
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
    timers,
    logger = silentLogger()
  } = options;

  const kinds = new AssetKindRegistry(handlers);
  await ensureGitignore(source);

  const state = await ProjectionState.load(source);
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
    timers,
    logger
  });
  scheduler.start();

  const identity = await CatalogIdentitySidecar.load(source);
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
    timers,
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

/**
 * Creates the state `.gitignore` only when it is absent.
 *
 * Other read failures leave a possibly edited file untouched.
 */
async function ensureGitignore(
  source: AssetSource
): Promise<void> {
  try {
    await source.read(STATE_GITIGNORE_PATH);

    return;
  }
  catch (error) {
    if (!isNotFound(error)) {
      return;
    }
  }

  await source.write(
    STATE_GITIGNORE_PATH,
    new TextEncoder().encode(STATE_GITIGNORE_CONTENT)
  );
}

function isNotFound(
  error: unknown
): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}
