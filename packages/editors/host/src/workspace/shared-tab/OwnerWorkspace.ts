// Import Third-party Dependencies
import { ChannelTransportHost } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { StandaloneConnection } from "../../editor/mountStandalone.ts";
import type { LaunchSource } from "../../launch/index.ts";
import type { OfflineWorkspace } from "../offline/OfflineWorkspace.ts";
import type { StandaloneWorkspace } from "../SessionWorkspace.ts";
import {
  HEARTBEAT_MS,
  parseOwnerMessage,
  openBridgeChannel,
  type OwnerMessage
} from "./protocol.ts";

export class OwnerWorkspace implements StandaloneWorkspace {
  readonly #workspace: OfflineWorkspace;
  readonly #channel: BroadcastChannel;
  readonly #host: ChannelTransportHost;
  readonly #hold: StandaloneConnection;
  readonly #heartbeat: ReturnType<typeof setInterval>;
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
      open: () => workspace.bridgeSocket()
    });
    this.#hold = workspace.connect();
    this.#channel.addEventListener("message", (event) => {
      this.#onMessage(event.data);
    }, { signal: this.#subscriptions.signal });
    this.#heartbeat = setInterval(() => {
      this.#announce("heartbeat");
    }, HEARTBEAT_MS);
    globalThis.window?.addEventListener("pagehide", () => {
      this.#announce("stopping");
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
      this.#announce("stopping");
      this.#closed = true;
      this.#subscriptions.abort();
      clearInterval(this.#heartbeat);
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

  #announce(
    type: "heartbeat" | "stopping"
  ): void {
    if (!this.#closed) {
      this.#channel.postMessage({
        type,
        tab: "*",
        owner: this.#host.id
      } satisfies OwnerMessage);
    }
  }
}
