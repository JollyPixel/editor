// Import Third-party Dependencies
import { ChannelTransportHost } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { StandaloneConnection } from "../../connection/StandaloneConnection.ts";
import type { LaunchSource } from "../../launch/index.ts";
import type { PeerSharing } from "../../connection/OfflineMode.ts";
import {
  OfflineServer,
  type OwnedDatabase
} from "../server/OfflineServer.ts";
import { PeerHost } from "../peer/PeerHost.ts";
import { PeerInvites } from "../peer/PeerInvites.ts";
import { BroadcastSignaling } from "../peer/signaling/BroadcastSignaling.ts";
import type { OfflineBackend } from "../OfflineBackend.ts";
import {
  parseOwnerMessage,
  openBridgeChannel,
  openSocketChannel,
  type OwnerMessage
} from "./protocol.ts";

export interface OfflineOwnerOptions extends OwnedDatabase {
  name: string;
}

interface OfflineOwnerParts {
  server: OfflineServer;
  name: string;
  peers: PeerHost;
}

export class OfflineOwner implements OfflineBackend {
  static async open(
    options: OfflineOwnerOptions
  ): Promise<OfflineOwner> {
    const { name, ...database } = options;
    const invites = new PeerInvites();
    const server = await OfflineServer.openOwner(database, invites);

    try {
      return new OfflineOwner({
        server,
        name,
        peers: new PeerHost({
          signaling: new BroadcastSignaling(),
          invites,
          open: (token) => server.bridgeSocket({ credential: token })
        })
      });
    }
    catch (error) {
      await server.close();

      throw error;
    }
  }

  readonly #server: OfflineServer;
  readonly #channel: BroadcastChannel;
  readonly #host: ChannelTransportHost;
  readonly #peers: PeerHost;
  readonly #hold: StandaloneConnection;
  readonly #subscriptions = new AbortController();
  #closed = false;

  constructor(
    parts: OfflineOwnerParts
  ) {
    const { server, name, peers } = parts;
    this.#server = server;
    this.#channel = openBridgeChannel(name);
    this.#host = new ChannelTransportHost({
      port: this.#channel,
      open: () => server.bridgeSocket(),
      socketPort: (socket) => openSocketChannel(name, socket)
    });
    this.#peers = peers;
    this.#hold = server.connect();
    this.#channel.addEventListener("message", (event) => {
      this.#onMessage(event.data);
    }, { signal: this.#subscriptions.signal });
    globalThis.window?.addEventListener("pagehide", () => {
      this.#peers.close();
    }, { signal: this.#subscriptions.signal });
  }

  get persistent(): boolean {
    return true;
  }

  get peers(): PeerSharing {
    return this.#peers;
  }

  async reset(): Promise<void> {
    await this.#server.reset();
    await this.close();
  }

  launchSources(
    accepts: string
  ): LaunchSource[] {
    return this.#server.launchSources(accepts);
  }

  connect(): StandaloneConnection {
    const connection = this.#server.connect();

    return {
      ...connection,
      offline: this
    };
  }

  async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      this.#subscriptions.abort();
      this.#host.close();
      this.#peers.close();
      this.#channel.close();
      this.#hold.client.destroy();
    }

    await this.#server.close();
  }

  #onMessage(
    data: unknown
  ): void {
    const message = parseOwnerMessage(data);
    if (!this.#closed && message?.type === "hello") {
      this.#channel.postMessage({
        type: "owner",
        tab: message.tab,
        owner: this.#host.id
      } satisfies OwnerMessage);
    }
  }
}
