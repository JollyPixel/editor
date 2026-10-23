// Import Third-party Dependencies
import {
  createAssetBackend,
  seedAssetSource,
  silentLogger,
  type AssetBackend,
  type AssetBackendTuning,
  type AssetEventDataMap,
  type AnyAssetKindHandler,
  type AssetSeedMap,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import { IndexedDbAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  LoopbackTransport,
  Server,
  type AuthenticationProvider,
  type ClientSocket,
  type SocketConnectOptions
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { guestConnection } from "../../connection/guest.ts";
import type { StandaloneConnection } from "../../connection/StandaloneConnection.ts";
import type { LaunchSource } from "../../launch/index.ts";
import type { OfflineBackend } from "../OfflineBackend.ts";
import { catalogLaunchSources } from "../catalogLaunchSources.ts";
import {
  openOfflineSource,
  openPersistentSource,
  type OfflineSource
} from "./openOfflineSource.ts";
import {
  DEFAULT_OFFLINE_NAME,
  offlineDatabaseName
} from "./databaseLock.ts";

export {
  DEFAULT_OFFLINE_NAME,
  OFFLINE_DATABASE_PREFIX
} from "./databaseLock.ts";

// CONSTANTS
const kPersistentSnapshotPolicy: SnapshotPolicy = {
  delay: 500,
  maxDelay: 5_000
};
const kEventLogDatabasePrefix = "jolly-events:";

export type OfflineStorage = "memory" | "indexeddb";

export type OfflineSeed =
  | AssetSeedMap
  | (() => AssetSeedMap | Promise<AssetSeedMap>);

export interface OfflineServerOptions {
  handlers: AnyAssetKindHandler[];
  seed?: OfflineSeed;
  storage?: OfflineStorage;
  name?: string;
  backend?: AssetBackendTuning;
}

export type OfflineProject = Pick<
  OfflineServerOptions,
  "handlers" | "seed" | "backend"
>;

export type OfflineProjectLoader = () => OfflineProject | Promise<OfflineProject>;

export interface OwnedDatabase {
  project: OfflineProjectLoader;
  databaseName: string;
  release: () => void;
}

export interface OfflineServerParts {
  backend: AssetBackend;
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  server: Server;
  detach: () => void;
  storage?: OfflineStorage;
  databaseName?: string;
  release?: () => void;
}

export class OfflineServer implements OfflineBackend {
  static async open(
    options: OfflineServerOptions
  ): Promise<OfflineServer> {
    const {
      storage: requested = "memory",
      name = DEFAULT_OFFLINE_NAME
    } = options;
    const databaseName = offlineDatabaseName(name);

    return OfflineServer.#start(
      () => options,
      databaseName,
      await openOfflineSource(requested, databaseName)
    );
  }

  static async openOwner(
    database: OwnedDatabase,
    auth: AuthenticationProvider
  ): Promise<OfflineServer> {
    const {
      project,
      databaseName,
      release
    } = database;

    return OfflineServer.#start(
      project,
      databaseName,
      await openPersistentSource(databaseName, release),
      auth
    );
  }

  static async #start(
    project: OfflineProjectLoader,
    databaseName: string,
    opened: OfflineSource,
    auth?: AuthenticationProvider
  ): Promise<OfflineServer> {
    const { source, storage, release } = opened;
    const persistent = storage === "indexeddb";

    let eventStore: EventStore.TypedEventStore<AssetEventDataMap> | undefined;
    let backend: AssetBackend | undefined;
    let server: Server | undefined;
    try {
      const {
        handlers,
        seed,
        backend: tuning = {}
      } = await project();
      eventStore = persistent ?
        await EventStore.persistence.indexeddb<AssetEventDataMap>({
          name: `${kEventLogDatabasePrefix}${databaseName}`
        }) :
        EventStore.persistence.memory<AssetEventDataMap>();
      if (seed !== undefined && (await source.list()).length === 0) {
        await seedAssetSource(
          source,
          typeof seed === "function" ? await seed() : seed,
          { handlers }
        );
      }

      backend = await createAssetBackend({
        ...tuning,
        source,
        eventStore,
        handlers,
        snapshot: tuning.snapshot ??
          (persistent ? kPersistentSnapshotPolicy : undefined),
        compaction: {
          ...tuning.compaction,
          onOpen: tuning.compaction?.onOpen ?? persistent
        },
        reconcile: {
          ...tuning.reconcile,
          watch: false
        }
      });
      server = new Server({
        logger: silentLogger(),
        auth,
        validateOutbound: false
      });

      return new OfflineServer({
        backend,
        eventStore,
        server,
        detach: backend.attach(server),
        storage,
        databaseName,
        release
      });
    }
    catch (error) {
      await Promise.allSettled([
        backend?.close(),
        server?.close()
      ]);
      try {
        eventStore?.close();
      }
      catch {
      }
      try {
        if (source instanceof IndexedDbAssetSource) {
          source.close();
        }
      }
      catch {
      }
      finally {
        release?.();
      }

      throw error;
    }
  }

  readonly backend: AssetBackend;
  readonly storage: OfflineStorage;

  #eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  #server: Server;
  #transport: LoopbackTransport;
  #detach: () => void;
  #databaseName: string | undefined;
  #release: (() => void) | undefined;
  #closing: Promise<void> | undefined;
  #connections = 0;

  readonly #onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      void this.backend.flush();
    }
  };

  readonly #onPageHide = (): void => {
    void this.backend.flush();
  };

  constructor(
    parts: OfflineServerParts
  ) {
    this.backend = parts.backend;
    this.storage = parts.storage ?? "memory";
    this.#eventStore = parts.eventStore;
    this.#server = parts.server;
    this.#detach = parts.detach;
    this.#databaseName = parts.databaseName;
    this.#release = parts.release;
    this.#transport = new LoopbackTransport({
      server: parts.server
    });

    if (this.persistent) {
      globalThis.document?.addEventListener(
        "visibilitychange",
        this.#onVisibilityChange
      );
      globalThis.window?.addEventListener(
        "pagehide",
        this.#onPageHide
      );
    }
  }

  get persistent(): boolean {
    return this.storage === "indexeddb";
  }

  bridgeSocket(
    options: SocketConnectOptions = {}
  ): ClientSocket {
    return this.#transport.connect(options);
  }

  launchSources(
    accepts: string
  ): LaunchSource[] {
    const { catalog } = this.backend;

    return catalogLaunchSources({
      accepts,
      isKnown: (assetId) => catalog.record(assetId)?.hasKind(accepts) === true,
      first: () => {
        const [first] = catalog.catalog.byKind(accepts);

        return first?.id.value;
      }
    });
  }

  connect(): StandaloneConnection {
    if (this.#closing !== undefined) {
      throw new Error("Offline server is closing.");
    }
    const { identity, client } = guestConnection(
      () => this.#transport.connect()
    );
    this.#connections++;
    let destroyed = false;

    return {
      identity,
      offline: this,
      client: {
        room: (name) => client.room(name),
        destroy: () => {
          if (destroyed) {
            return;
          }
          destroyed = true;
          client.destroy();
          this.#connections--;
          if (this.#connections === 0) {
            void this.close();
          }
        }
      }
    };
  }

  async reset(): Promise<void> {
    await this.close();
    if (this.persistent && this.#databaseName !== undefined) {
      await Promise.all([
        IndexedDbAssetSource.destroy({
          name: this.#databaseName
        }),
        EventStore.persistence.indexeddb.destroy({
          name: `${kEventLogDatabasePrefix}${this.#databaseName}`
        })
      ]);
    }
  }

  close(): Promise<void> {
    this.#closing ??= this.#close();

    return this.#closing;
  }

  async #close(): Promise<void> {
    globalThis.document?.removeEventListener(
      "visibilitychange",
      this.#onVisibilityChange
    );
    globalThis.window?.removeEventListener(
      "pagehide",
      this.#onPageHide
    );

    this.#detach();
    await this.#server.close();
    await this.backend.flush();
    await this.backend.close();
    this.#eventStore.close();

    const { source } = this.backend;
    if (source instanceof IndexedDbAssetSource) {
      source.close();
    }
    this.#release?.();
  }
}
