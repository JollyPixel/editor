// Import Node.js Dependencies
import crypto from "node:crypto";

// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import {
  CatalogClient,
  catalogRoom
} from "@jolly-pixel/asset-server/catalog/client";

export async function withCatalog<T>(
  socketUrl: string,
  fn: (catalog: CatalogClient) => Promise<T>
): Promise<T> {
  const client = new network.Client({
    url: socketUrl
  });
  const catalog = new CatalogClient(catalogRoom(client));

  try {
    await catalog.ready;

    return await fn(catalog);
  }
  finally {
    catalog.dispose();
    client.destroy();
  }
}

export function e2eFolder(): string {
  return `e2e/${crypto.randomUUID()}`;
}
