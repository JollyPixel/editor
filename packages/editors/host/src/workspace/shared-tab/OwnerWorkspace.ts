// Import Third-party Dependencies
import { ChannelTransportHost } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { LaunchSource } from "../../launch/index.ts";
import {
  OfflineWorkspace,
  type OfflineOwnerOptions
} from "../offline/OfflineWorkspace.ts";
import { PeerHost } from "../peer/PeerHost.ts";
import { PeerInvites } from "../peer/PeerInvites.ts";
import { BroadcastSignaling } from "../peer/signaling/BroadcastSignaling.ts";
import type {
  PeerSharing,
  StandaloneConnection,
  StandaloneWorkspace
} from "../SessionWorkspace.ts";
import {
  parseOwnerMessage,
  openBridgeChannel,
  openSocketChannel,
  type OwnerMessage
} from "./protocol.ts";

export interface OwnerWorkspaceOptions extends Omit<
  OfflineOwnerOptions, "auth"
> {
  name: string;
}

interface OwnerWorkspaceParts {
  workspace: OfflineWorkspace;
  name: string;
  peers: PeerHost;
}

export class OwnerWorkspace implements StandaloneWorkspace {
  static async open(
    options: OwnerWorkspaceOptions
  ): Promise<OwnerWorkspace> {
    const { name, ...owner } = options;
    const invites = new PeerInvites();
    const workspace = await OfflineWorkspace.openOwner({
      ...owner,
      auth: invites
    });

    try {
      return new OwnerWorkspace({
        workspace,
        name,
        peers: new PeerHost({
          signaling: new BroadcastSignaling(),
          invites,
          open: (token) => workspace.bridgeSocket({ credential: token })
        })
      });
    }
    catch (error) {
      await workspace.close();

      throw error;
    }
  }

  readonly #workspace: OfflineWorkspace;
  readonly #channel: BroadcastChannel;
  readonly #host: ChannelTransportHost;
  readonly #peers: PeerHost;
  readonly #hold: StandaloneConnection;
  readonly #subscriptions = new AbortController();
  #closed = false;

  constructor(
    parts: OwnerWorkspaceParts
  ) {
    const { workspace, name, peers } = parts;
    this.#workspace = workspace;
    this.#channel = openBridgeChannel(name);
    this.#host = new ChannelTransportHost({
      port: this.#channel,
      open: () => workspace.bridgeSocket(),
      socketPort: (socket) => openSocketChannel(name, socket)
    });
    this.#peers = peers;
    this.#hold = workspace.connect();
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
      this.#peers.close();
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
