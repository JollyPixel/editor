// Import Third-party Dependencies
import { ChannelTransportHost } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { LaunchSource } from "../../launch/index.ts";
import type { OfflineWorkspace } from "../offline/OfflineWorkspace.ts";
import type {
  StandaloneConnection,
  StandaloneWorkspace
} from "../SessionWorkspace.ts";
import {
  parseOwnerMessage,
  openBridgeChannel,
  openSocketChannel,
  type OwnerMessage
} from "./protocol.ts";

export class OwnerWorkspace implements StandaloneWorkspace {
  readonly #workspace: OfflineWorkspace;
  readonly #channel: BroadcastChannel;
  readonly #host: ChannelTransportHost;
  readonly #hold: StandaloneConnection;
  readonly #subscriptions = new AbortController();
  #closed = false;

  constructor(
    workspace: OfflineWorkspace,
    name: string
  ) {
    this.#workspace = workspace;
    this.#channel = openBridgeChannel(name);
    this.#host = new ChannelTransportHost({
      port: this.#channel,
      open: () => workspace.bridgeSocket(),
      socketPort: (socket) => openSocketChannel(name, socket)
    });
    this.#hold = workspace.connect();
    this.#channel.addEventListener("message", (event) => {
      this.#onMessage(event.data);
    }, { signal: this.#subscriptions.signal });
  }

  get persistent(): boolean {
    return true;
  }

  async reset(): Promise<void> {
    await this.#workspace.reset();
    await this.close();
  }

  launchSources(
    accepts: string
  ): LaunchSource[] {
    return this.#workspace.launchSources(accepts);
  }

  connect(): StandaloneConnection {
    const connection = this.#workspace.connect();

    return {
      ...connection,
      workspace: this
    };
  }

  async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      this.#subscriptions.abort();
      this.#host.close();
      this.#channel.close();
      this.#hold.client.destroy();
    }

    await this.#workspace.close();
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
