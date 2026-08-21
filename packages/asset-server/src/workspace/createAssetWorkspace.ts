// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Server,
  type Extension,
  type RightsMap
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import { FilesystemAssetSource } from "../sources/persistence/FilesystemAssetSource.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";
import {
  createAssetBackend,
  type AssetBackend,
  type AssetBackendOptions
} from "../createAssetBackend.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { openAssetEventStore } from "./openAssetEventStore.ts";
import {
  seedAssetSource,
  type AssetSeedMap
} from "./seedAssetSource.ts";

export type AssetBackendTuning = Omit<
  AssetBackendOptions,
  "source" | "eventStore" | "handlers" | "logger"
>;

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
   * @default FilesystemAssetSource on `root`
   */
  source?: AssetSource;
  /**
   * @default sqlite log inside the workspace state directory
   */
  eventStore?: EventStore.EventStore;
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
  logger?: Logger;
  /**
   * Grace period, in milliseconds, before an empty asset room is evicted.
   */
  roomGraceMs?: number;
  backend?: AssetBackendTuning;
}

export interface AssetWorkspace extends AsyncDisposable {
  readonly source: AssetSource;
  readonly eventStore: EventStore.EventStore;
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
    extensions = [],
    rights,
    logger = silentLogger(),
    roomGraceMs,
    backend: tuning = {}
  } = options;

  const source = options.source ?? new FilesystemAssetSource(root);
  // Seeding precedes the back-end so its first reconciliation catalogs the
  // starter documents.
  if (seed) {
    await seedAssetSource(source, seed);
  }

  const ownsEventStore = options.eventStore === undefined;
  const eventStore = options.eventStore ?? await openAssetEventStore(root);

  const backend = await createAssetBackend({
    ...tuning,
    source,
    eventStore,
    handlers,
    logger
  });

  // The network server keeps its own default logger: a workspace with no
  // logger silences the back-end, not the transport.
  const server = options.server ?? new Server({
    eventStore,
    rights,
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
