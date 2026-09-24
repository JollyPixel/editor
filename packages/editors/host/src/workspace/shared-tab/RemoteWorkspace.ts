// Import Third-party Dependencies
import type { ClientSocketEvent } from "@jolly-pixel/network/client";
import { ChannelTransport } from "@jolly-pixel/network/transport/channel.ts";

// Import Internal Dependencies
import type { StandaloneConnection } from "../../editor/mountStandalone.ts";
import type { LaunchSource } from "../../launch/index.ts";
import { openCatalog } from "../../session/openCatalog.ts";
import { catalogLaunchSources } from "../catalogLaunchSources.ts";
import { guestConnection } from "../guestConnection.ts";
import type { StandaloneWorkspace } from "../SessionWorkspace.ts";
import { OwnerMonitor } from "./OwnerMonitor.ts";
import {
  DISCOVERY_INTERVAL_MS,
  parseOwnerMessage,
  openBridgeChannel
} from "./protocol.ts";

export class RemoteWorkspace implements StandaloneWorkspace {
  static async open(
    name: string
  ): Promise<RemoteWorkspace> {
    const workspace = new RemoteWorkspace(name);
    try {
      workspace.#transport = new ChannelTransport({
        port: workspace.#channel,
        host: await workspace.#monitor.discover()
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
  #transport: ChannelTransport | undefined;
  #closed = false;

  constructor(
    name: string
  ) {
    this.#channel = openBridgeChannel(name);
    this.#monitor = new OwnerMonitor({
      channel: this.#channel,
      tab: this.#tab,
      onLost: () => this.#ownerLost()
    });
    this.#channel.addEventListener("message", (event) => {
      const message = parseOwnerMessage(event.data);
      if (
        message !== undefined &&
        message.type !== "hello" &&
        (message.tab === this.#tab || message.tab === "*")
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

  async launchSources(
    accepts: string
  ): Promise<LaunchSource[]> {
    const connection = this.connect();
    const catalog = await openCatalog(connection.client);
    try {
      const known = new Set(
        [...catalog.records()]
          .filter((record) => record.kind === accepts)
          .map((record) => record.id)
      );
      const [first] = known;

      return catalogLaunchSources({
        accepts,
        isKnown: (assetId) => known.has(assetId),
        first: () => first
      });
    }
    finally {
      catalog.dispose();
      connection.client.destroy();
    }
  }

  connect(): StandaloneConnection {
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

  reset(): Promise<void> {
    throw new Error("Reset the workspace in its owner tab.");
  }

  async close(): Promise<void> {
    this.#shutdown();
  }

  #shutdown(
    event?: ClientSocketEvent
  ): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
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
