// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type { StandaloneConnection } from "../connection/StandaloneConnection.ts";
import { openCatalog } from "../connection/openCatalog.ts";

interface SharedConnection {
  readonly connection: StandaloneConnection;
  readonly catalog: Promise<CatalogClient>;
}

export class ConnectionHandoff {
  readonly #open: () => StandaloneConnection;
  #shared: SharedConnection | null = null;
  #taken = false;

  constructor(
    open: () => StandaloneConnection
  ) {
    this.#open = open;
  }

  catalog(): Promise<CatalogClient> {
    return this.#first().catalog;
  }

  take(): StandaloneConnection {
    if (this.#taken) {
      return this.#open();
    }

    this.#taken = true;
    const { connection, catalog } = this.#first();

    return {
      ...connection,
      openCatalog: () => catalog
    };
  }

  release(): void {
    const shared = this.#shared;
    if (this.#taken || shared === null) {
      return;
    }

    this.#shared = null;
    void shared.catalog.then((catalog) => catalog.dispose(), () => undefined);
    shared.connection.client.destroy();
  }

  #first(): SharedConnection {
    if (this.#shared === null) {
      const connection = this.#open();
      const catalog = openCatalog(connection.client);
      catalog.catch(() => undefined);
      this.#shared = {
        connection,
        catalog
      };
    }

    return this.#shared;
  }
}
