// Import Third-party Dependencies
import type {
  ChannelTransport,
  ClientSocketEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { guestConnection } from "../connection/guest.ts";
import type { StandaloneConnection } from "../connection/StandaloneConnection.ts";
import {
  EditorLaunch,
  type LaunchSource
} from "../launch/index.ts";
import { catalogLaunchSources } from "./catalogLaunchSources.ts";
import { ConnectionHandoff } from "./ConnectionHandoff.ts";
import type { OfflineBackend } from "./OfflineBackend.ts";

// CONSTANTS
const kHostLeft = {
  code: 1001,
  reason: "The offline host left."
};

export interface OfflineGuestOptions {
  transport: ChannelTransport;
  hostLost: Promise<void>;
  onHostLost: () => void;
  onClose: () => void;
  onUnauthorized?: () => void;
}

export class OfflineGuest implements OfflineBackend {
  readonly #transport: ChannelTransport;
  readonly #onClose: () => void;
  readonly #onUnauthorized: (() => void) | undefined;
  readonly #subscriptions = new AbortController();
  readonly #handoff = new ConnectionHandoff(() => this.#open());
  #closed = false;

  constructor(
    options: OfflineGuestOptions
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
    return this.#handoff.take();
  }

  reset(): Promise<void> {
    throw new Error("Only the tab that owns the offline data can reset it.");
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
    this.#handoff.release();
    this.#subscriptions.abort();
    this.#transport.close(event);
    this.#onClose();
  }

  #open(): StandaloneConnection {
    if (this.#closed) {
      throw new Error("The offline host is unavailable.");
    }
    const { identity, client } = guestConnection(
      () => this.#transport.connect()
    );
    if (this.#onUnauthorized !== undefined) {
      client.on("unauthorized", this.#onUnauthorized);
    }

    return {
      identity,
      offline: this,
      client
    };
  }

  async #readLaunch(
    accepts: string
  ): Promise<EditorLaunch | undefined> {
    let launch: EditorLaunch | undefined;
    try {
      const catalog = await this.#handoff.catalog();
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
        this.#handoff.release();
      }
    }

    return launch;
  }
}
