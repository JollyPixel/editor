// Import Third-party Dependencies
import type {
  ChannelTransport,
  ClientSocketEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  EditorLaunch,
  type LaunchSource
} from "../launch/index.ts";
import { openCatalog } from "../session/openCatalog.ts";
import { catalogLaunchSources } from "./catalogLaunchSources.ts";
import {
  ConnectionHandoff,
  ParkedConnection
} from "./ConnectionHandoff.ts";
import { guestConnection } from "./guestConnection.ts";
import type {
  StandaloneConnection,
  StandaloneWorkspace
} from "./SessionWorkspace.ts";

// CONSTANTS
const kHostLeft = {
  code: 1001,
  reason: "The workspace host left."
};

export interface GuestWorkspaceOptions {
  transport: ChannelTransport;
  hostLost: Promise<void>;
  onHostLost: () => void;
  onClose: () => void;
  onUnauthorized?: () => void;
}

export class GuestWorkspace implements StandaloneWorkspace {
  readonly #transport: ChannelTransport;
  readonly #onClose: () => void;
  readonly #onUnauthorized: (() => void) | undefined;
  readonly #subscriptions = new AbortController();
  readonly #handoff = new ConnectionHandoff();
  #closed = false;

  constructor(
    options: GuestWorkspaceOptions
  ) {
    this.#transport = options.transport;
    this.#onClose = options.onClose;
    this.#onUnauthorized = options.onUnauthorized;
    globalThis.window?.addEventListener("pagehide", () => {
      void this.close();
    }, { signal: this.#subscriptions.signal });
    void options.hostLost.then(() => {
      if (!this.#closed) {
        this.#end(kHostLeft);
        options.onHostLost();
      }
    });
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
    throw new Error("Only the tab that owns the workspace can reset it.");
  }

  async close(): Promise<void> {
    this.#end();
  }

  #end(
    event?: ClientSocketEvent
  ): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#handoff.close();
    this.#subscriptions.abort();
    this.#transport.close(event);
    this.#onClose();
  }

  #open(): StandaloneConnection {
    if (this.#closed) {
      throw new Error("The workspace host is unavailable.");
    }
    const { identity, client } = guestConnection(
      () => this.#transport.connect()
    );
    if (this.#onUnauthorized !== undefined) {
      client.on("unauthorized", this.#onUnauthorized);
    }

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
}
