// Import Third-party Dependencies
import {
  ChannelTransport,
  type ClientSocketEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  EditorLaunch,
  type LaunchSource
} from "../../launch/index.ts";
import { openCatalog } from "../../session/openCatalog.ts";
import { catalogLaunchSources } from "../catalogLaunchSources.ts";
import { guestConnection } from "../guestConnection.ts";
import type {
  StandaloneConnection,
  StandaloneWorkspace
} from "../SessionWorkspace.ts";
import {
  ConnectionHandoff,
  ParkedConnection
} from "./ConnectionHandoff.ts";
import { OwnerMonitor } from "./OwnerMonitor.ts";
import {
  DISCOVERY_INTERVAL_MS,
  parseOwnerMessage,
  openBridgeChannel,
  openSocketChannel
} from "./protocol.ts";

export class RemoteWorkspace implements StandaloneWorkspace {
  static async open(
    name: string,
    databaseName: string
  ): Promise<RemoteWorkspace> {
    const workspace = new RemoteWorkspace(name, databaseName);
    try {
      workspace.#transport = new ChannelTransport({
        port: workspace.#channel,
        host: await workspace.#monitor.discover(),
        socketPort: (socket) => openSocketChannel(name, socket)
      });
    }
    catch (error) {
      await workspace.close();

      throw error;
    }

    return workspace;
  }

  readonly #channel: BroadcastChannel;
  readonly #tab = crypto.randomUUID();
  readonly #monitor: OwnerMonitor;
  readonly #subscriptions = new AbortController();
  readonly #handoff = new ConnectionHandoff();
  #transport: ChannelTransport | undefined;
  #closed = false;

  constructor(
    name: string,
    databaseName: string
  ) {
    this.#channel = openBridgeChannel(name);
    this.#monitor = new OwnerMonitor({
      channel: this.#channel,
      tab: this.#tab,
      lock: databaseName,
      onLost: () => this.#ownerLost()
    });
    this.#channel.addEventListener("message", (event) => {
      const message = parseOwnerMessage(event.data);
      if (
        message?.type === "owner" &&
        message.tab === this.#tab
      ) {
        this.#monitor.handle(message);
      }
    }, { signal: this.#subscriptions.signal });
    globalThis.window?.addEventListener("pagehide", () => {
      void this.close();
    }, { signal: this.#subscriptions.signal });
  }

  get persistent(): boolean {
    return true;
  }

  get canReset(): boolean {
    return false;
  }

  launchSources(
    accepts: string
  ): LaunchSource[] {
    return [
      {
        read: () => this.#readLaunch(accepts)
      }
    ];
  }

  connect(): StandaloneConnection {
    return this.#handoff.take() ?? this.#open();
  }

  reset(): Promise<void> {
    throw new Error("Reset the workspace in its owner tab.");
  }

  async close(): Promise<void> {
    this.#shutdown();
  }

  #open(): StandaloneConnection {
    const transport = this.#transport;
    if (transport === undefined || this.#closed) {
      throw new Error("The shared workspace owner is unavailable.");
    }
    const { identity, client } = guestConnection(
      () => transport.connect()
    );

    return {
      identity,
      workspace: this,
      client
    };
  }

  async #readLaunch(
    accepts: string
  ): Promise<EditorLaunch | undefined> {
    const connection = this.#open();
    const catalog = await openCatalog(connection.client);
    const parked = new ParkedConnection(connection, catalog);
    let launch: EditorLaunch | undefined;
    try {
      const known = new Set(
        [...catalog.records()]
          .filter((record) => record.kind === accepts)
          .map((record) => record.id)
      );
      const [first] = known;

      launch = await EditorLaunch.first(catalogLaunchSources({
        accepts,
        isKnown: (assetId) => known.has(assetId),
        first: () => first
      }));
    }
    finally {
      if (launch === undefined) {
        parked.release();
      }
      else {
        this.#handoff.park(parked);
      }
    }

    return launch;
  }

  #shutdown(
    event?: ClientSocketEvent
  ): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#handoff.close();
    this.#monitor.stop();
    this.#subscriptions.abort();
    this.#transport?.close(event);
    this.#channel.close();
  }

  #ownerLost(): void {
    if (this.#closed) {
      return;
    }
    this.#shutdown({
      code: 1001,
      reason: "Workspace owner closed."
    });
    setTimeout(() => location.reload(), DISCOVERY_INTERVAL_MS);
  }
}
