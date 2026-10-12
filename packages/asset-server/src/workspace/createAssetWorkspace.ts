// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  MemoryAssetSource,
  type AssetSource
} from "@jolly-pixel/asset-source";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source/node";
import * as EventStore from "@jolly-pixel/event-store";
import {
  Server,
  type Extension,
  type AuthenticationProvider,
  type RightsMap,
  type RoomAdmission
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { EVENTS_DB_PATH } from "../stateDirectory.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  type AssetEventDataMap
} from "../events/AssetEvents.ts";
import {
  createAssetBackend,
  type AssetBackend,
  type AssetBackendTuning
} from "../createAssetBackend.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import {
  seedAssetSource,
  type AssetSeedMap
} from "./seedAssetSource.ts";

export interface AssetWorkspaceOptions {
  /**
   * Filesystem root of the workspace, behind the default source and the
   * default event log.
   */
  root: string;
  handlers?: AssetKindHandler[];
  /**
   * Documents written when the workspace holds no file at their path.
   */
  seed?: AssetSeedMap;
  /**
   * Swaps the default source and event log for in-memory ones, so the
   * workspace never reads or writes `root`.
   * @default false
   */
  inMemory?: boolean;
  /**
   * @default FilesystemAssetSource on `root`, or MemoryAssetSource when
   * `inMemory`
   */
  source?: AssetSource;
  /**
   * @default sqlite log inside the workspace state directory, or an
   * in-memory log when `inMemory`
   */
  eventStore?: EventStore.TypedEventStore<AssetEventDataMap>;
  /**
   * Network server hosting the catalog and asset rooms. Pass one already
   * carrying extensions instead of letting the workspace build it.
   */
  server?: Server;
  /**
   * Extensions registered before the asset rooms are attached.
   */
  extensions?: Extension[];
  rights?: RightsMap;
  defaultRole?: string;
  auth?: AuthenticationProvider;
  admits?: RoomAdmission;
  logger?: Logger;
  /**
   * Grace period, in milliseconds, before an empty asset room is evicted.
   */
  roomGraceMs?: number;
  /**
   * Drops the events superseded by each asset's newest lifecycle
   * checkpoint before the back-end loads its projections.
   *
   * Destructive and irreversible: it trades the editing history nothing
   * reads for a log that stops growing without bound.
   * @default true
   */
  compactOnOpen?: boolean;
  backend?: AssetBackendTuning;
}

export interface AssetWorkspace extends AsyncDisposable {
  readonly source: AssetSource;
  readonly eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  readonly backend: AssetBackend;
  readonly server: Server;

  close(): Promise<void>;
}

/**
 * Assembles the pieces a host needs to edit an asset workspace live: a
 * source, an event log, the back-end and the network server its rooms are
 * attached to.
 *
 * Owns only what it creates. A source, event store or server passed in is
 * left open by `close()`.
 */
export async function createAssetWorkspace(
  options: AssetWorkspaceOptions
): Promise<AssetWorkspace> {
  const {
    root,
    handlers = [],
    seed,
    inMemory = false,
    extensions = [],
    rights,
    defaultRole,
    auth,
    admits,
    logger = silentLogger(),
    roomGraceMs,
    compactOnOpen = true,
    backend: tuning = {}
  } = options;

  const source = options.source ?? (
    inMemory ? new MemoryAssetSource() : new FilesystemAssetSource(root)
  );
  if (seed) {
    await seedAssetSource(source, seed, { handlers });
  }

  const ownsEventStore = options.eventStore === undefined;
  const eventStore = options.eventStore ?? (inMemory ?
    EventStore.persistence.memory<AssetEventDataMap>() :
    await EventStore.persistence.sqlite<AssetEventDataMap>(
      path.join(root, EVENTS_DB_PATH)
    ));

  if (compactOnOpen) {
    const report = eventStore.compact({
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES
    });
    logger
      .withMetadata(report)
      .debug("event log compacted");
  }

  const backend = await createAssetBackend({
    compactOnSnapshot: compactOnOpen,
    ...tuning,
    source,
    eventStore,
    handlers,
    logger
  });

  const server = options.server ?? new Server({
    rights,
    defaultRole,
    auth,
    admits,
    roomGraceMs,
    logger: options.logger
  });
  for (const extension of extensions) {
    server.register(extension);
  }
  const detach = backend.attach(server);

  const workspace: AssetWorkspace = {
    source,
    eventStore,
    backend,
    server,

    async close() {
      detach();
      await backend.close();
      if (ownsEventStore) {
        eventStore.close();
      }
    },

    async [Symbol.asyncDispose]() {
      await workspace.close();
    }
  };

  return workspace;
}
