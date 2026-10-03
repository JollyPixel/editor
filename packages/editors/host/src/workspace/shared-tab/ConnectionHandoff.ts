// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type { StandaloneConnection } from "../SessionWorkspace.ts";

export class ParkedConnection {
  readonly #connection: StandaloneConnection;
  readonly #catalog: CatalogClient;

  constructor(
    connection: StandaloneConnection,
    catalog: CatalogClient
  ) {
    this.#connection = connection;
    this.#catalog = catalog;
  }

  toConnection(): StandaloneConnection {
    const catalog = this.#catalog;

    return {
      ...this.#connection,
      openCatalog: () => Promise.resolve(catalog)
    };
  }

  release(): void {
    this.#catalog.dispose();
    this.#connection.client.destroy();
  }
}

export class ConnectionHandoff {
  #parked: ParkedConnection | null = null;
  #settled = false;

  park(
    connection: ParkedConnection
  ): void {
    this.#releaseParked();
    if (this.#settled) {
      connection.release();
    }
    else {
      this.#parked = connection;
    }
  }

  take(): StandaloneConnection | undefined {
    this.#settled = true;
    const parked = this.#parked;
    this.#parked = null;

    return parked?.toConnection();
  }

  close(): void {
    this.#settled = true;
    this.#releaseParked();
  }

  #releaseParked(): void {
    this.#parked?.release();
    this.#parked = null;
  }
}
