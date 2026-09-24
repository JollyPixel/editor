// Import Third-party Dependencies
import {
  createAssetBackend,
  PROJECTION_STATE_PATH,
  seedAssetSource,
  silentLogger,
  type AssetBackend,
  type AssetEventDataMap,
  type AssetKindHandler,
  type AssetSeedMap,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server/backend";
import { IndexedDbAssetSource } from "@jolly-pixel/asset-source/indexeddb";
import * as EventStore from "@jolly-pixel/event-store";
import { Server } from "@jolly-pixel/network";
import type { ClientSocket } from "@jolly-pixel/network/client";
import { LoopbackTransport } from "@jolly-pixel/network/transport/loopback.ts";

// Import Internal Dependencies
import type { StandaloneConnection } from "../../editor/mountStandalone.ts";
import type { LaunchSource } from "../../launch/index.ts";
import type { StandaloneWorkspace } from "../SessionWorkspace.ts";
import { catalogLaunchSources } from "../catalogLaunchSources.ts";
import { guestConnection } from "../guestConnection.ts";
import { openOfflineSource } from "./openOfflineSource.ts";

// CONSTANTS
export const OFFLINE_DATABASE_PREFIX = "jolly-workspace:";
export const DEFAULT_OFFLINE_WORKSPACE_NAME = "default";

const kPersistentSnapshotPolicy: SnapshotPolicy = {
  delay: 500,
  maxDelay: 5_000
};

export type OfflineStorage = "memory" | "indexeddb";

export type OfflineSeed =
  | AssetSeedMap
  | (() => AssetSeedMap | Promise<AssetSeedMap>);

export interface OfflineWorkspaceOptions {
  handlers: AssetKindHandler[];
  seed?: OfflineSeed;
  storage?: OfflineStorage;
  name?: string;
}

export interface OfflineWorkspaceParts {
  backend: AssetBackend;
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  server: Server;
  detach: () => void;
  storage?: OfflineStorage;
  databaseName?: string;
  release?: () => void;
}

export class OfflineWorkspace implements StandaloneWorkspace {
  static async open(
    options: OfflineWorkspaceOptions
  ): Promise<OfflineWorkspace> {
    const {
      handlers,
      seed,
      storage: requested = "memory",
      name = DEFAULT_OFFLINE_WORKSPACE_NAME
    } = options;
    const databaseName = `${OFFLINE_DATABASE_PREFIX}${name}`;
    const { source, storage, release } = await openOfflineSource(
      requested,
      databaseName
    );

    let eventStore: EventStore.TypedEventStore<AssetEventDataMap> | undefined;
    let backend: AssetBackend | undefined;
    let server: Server | undefined;
    try {
      await source.delete(PROJECTION_STATE_PATH);
      if (seed !== undefined && (await source.list()).length === 0) {
        await seedAssetSource(
          source,
          typeof seed === "function" ? await seed() : seed,
          { handlers }
        );
      }

      eventStore = EventStore.persistence.memory<AssetEventDataMap>();
      backend = await createAssetBackend({
        source,
        eventStore,
        handlers,
        snapshot: storage === "indexeddb" ? kPersistentSnapshotPolicy : undefined,
        watch: false
      });
      server = new Server({
        logger: silentLogger()
      });

      return new OfflineWorkspace({
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
        // Preserve the startup error.
      }
      try {
        if (source instanceof IndexedDbAssetSource) {
          source.close();
        }
      }
      catch {
        // Preserve the startup error.
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
    parts: OfflineWorkspaceParts
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

  bridgeSocket(): ClientSocket {
    return this.#transport.connect();
  }

  launchSources(
    accepts: string
  ): LaunchSource[] {
    const { catalog } = this.backend;

    return catalogLaunchSources({
      accepts,
      isKnown: (assetId) => catalog.record(assetId)?.kind === accepts,
      first: () => {
        const [first] = catalog.catalog.byKind(accepts);

        return first?.id.value;
      }
    });
  }

  connect(): StandaloneConnection {
    if (this.#closing !== undefined) {
      throw new Error("Offline workspace is closing.");
    }
    const { identity, client } = guestConnection(
      () => this.#transport.connect()
    );
    this.#connections++;
    let destroyed = false;

    return {
      identity,
      workspace: this,
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
      await IndexedDbAssetSource.destroy({
        name: this.#databaseName
      });
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
