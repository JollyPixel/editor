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
import { EVENTS_DB_PATH } from "../storage/stateDirectory.ts";
import type { AnyAssetKindHandler } from "../model/kinds/AssetKindHandler.ts";
import type { AssetEventDataMap } from "../model/events/AssetEvents.ts";
import {
  createAssetBackend,
  type AssetBackend,
  type AssetBackendTuning
} from "../createAssetBackend.ts";
import {
  silentLogger,
  type Logger
} from "../common/logger.ts";
import {
  seedAssetSource,
  type AssetSeedMap
} from "../storage/seedAssetSource.ts";

export interface AssetServerOptions {
  /**
   * Filesystem root of the project, behind the default source and the
   * default event log.
   */
  root: string;
  handlers?: AnyAssetKindHandler[];
  /**
   * Documents written when the project holds no file at their path.
   */
  seed?: AssetSeedMap;
  /**
   * Swaps the default source and event log for in-memory ones, so the
   * server never reads or writes `root`.
   * @default false
   */
  inMemory?: boolean;
  /**
   * @default FilesystemAssetSource on `root`, or MemoryAssetSource when
   * `inMemory`
   */
  source?: AssetSource;
  /**
   * @default sqlite log inside the project state directory, or an
   * in-memory log when `inMemory`
   */
  eventStore?: EventStore.TypedEventStore<AssetEventDataMap>;
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

interface AssetServerParts {
  source: AssetSource;
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  ownsEventStore: boolean;
  backend: AssetBackend;
  network: Server;
  detach: () => void;
}

export class AssetServer implements AsyncDisposable {
  static async open(
    options: AssetServerOptions
  ): Promise<AssetServer> {
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

    const backend = await createAssetBackend({
      compactOnOpen,
      compactOnSnapshot: compactOnOpen,
      ...tuning,
      source,
      eventStore,
      handlers,
      logger
    });

    const network = new Server({
      rights,
      defaultRole,
      auth,
      admits,
      roomGraceMs,
      logger: options.logger
    });
    for (const extension of extensions) {
      network.register(extension);
    }

    return new AssetServer({
      source,
      eventStore,
      ownsEventStore,
      backend,
      network,
      detach: backend.attach(network)
    });
  }

  readonly source: AssetSource;
  readonly eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  readonly backend: AssetBackend;
  readonly network: Server;

  #ownsEventStore: boolean;
  #detach: () => void;

  private constructor(
    parts: AssetServerParts
  ) {
    this.source = parts.source;
    this.eventStore = parts.eventStore;
    this.backend = parts.backend;
    this.network = parts.network;
    this.#ownsEventStore = parts.ownsEventStore;
    this.#detach = parts.detach;
  }

  async close(): Promise<void> {
    this.#detach();
    await this.backend.close();
    if (this.#ownsEventStore) {
      this.eventStore.close();
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
