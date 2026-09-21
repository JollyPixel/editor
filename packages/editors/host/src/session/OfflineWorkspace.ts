// Import Third-party Dependencies
import {
  createAssetBackend,
  seedAssetSource,
  silentLogger,
  type AssetBackend,
  type AssetEventDataMap,
  type AssetKindHandler,
  type AssetSeedMap
} from "@jolly-pixel/asset-server/backend";
import { MemoryAssetSource } from "@jolly-pixel/asset-source/core";
import { colorFromKey } from "@jolly-pixel/color";
import * as EventStore from "@jolly-pixel/event-store";
import { Server } from "@jolly-pixel/network";
import { Client } from "@jolly-pixel/network/client";
import { LoopbackTransport } from "@jolly-pixel/network/transport/loopback.ts";
import {
  GUEST_USERNAME,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { StandaloneConnection } from "../editor/mountStandalone.ts";

export interface OfflineWorkspaceOptions {
  handlers: AssetKindHandler[];
  /**
   * Documents the workspace starts with, keyed by asset path.
   */
  seed?: AssetSeedMap;
}

export interface OfflineWorkspaceParts {
  backend: AssetBackend;
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  server: Server;
  detach: () => void;
}

/**
 * An asset back-end living in the page, on memory storage. Nothing outlives
 * the page.
 */
export class OfflineWorkspace {
  static async open(
    options: OfflineWorkspaceOptions
  ): Promise<OfflineWorkspace> {
    const source = new MemoryAssetSource();
    if (options.seed !== undefined) {
      await seedAssetSource(source, options.seed);
    }

    const eventStore = EventStore.persistence.memory<AssetEventDataMap>();
    const backend = await createAssetBackend({
      source,
      eventStore,
      handlers: options.handlers,
      watch: false
    });
    const server = new Server({
      logger: silentLogger()
    });

    return new OfflineWorkspace({
      backend,
      eventStore,
      server,
      detach: backend.attach(server)
    });
  }

  readonly backend: AssetBackend;

  #eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  #server: Server;
  #transport: LoopbackTransport;
  #detach: () => void;
  #closing: Promise<void> | undefined;

  constructor(
    parts: OfflineWorkspaceParts
  ) {
    this.backend = parts.backend;
    this.#eventStore = parts.eventStore;
    this.#server = parts.server;
    this.#detach = parts.detach;
    this.#transport = new LoopbackTransport({
      server: parts.server
    });
  }

  connect(): StandaloneConnection {
    const peerId = crypto.randomUUID();
    const identity: PeerIdentity = {
      username: GUEST_USERNAME,
      peerId,
      color: colorFromKey(peerId)
    };
    const client = new Client({
      profile: toPeerMetadata(identity),
      socket: () => this.#transport.connect()
    });

    return {
      identity,
      client: {
        room: (name) => client.room(name),
        destroy: () => {
          client.destroy();
          void this.close();
        }
      }
    };
  }

  close(): Promise<void> {
    this.#closing ??= this.#close();

    return this.#closing;
  }

  async #close(): Promise<void> {
    this.#detach();
    await this.#server.close();
    await this.backend.close();
    this.#eventStore.close();
  }
}
