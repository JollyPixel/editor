// Import Node.js Dependencies
import crypto from "node:crypto";

// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import { CatalogClient } from "@jolly-pixel/asset-server/catalog/client";

export async function withCatalog<T>(
  socketUrl: string,
  fn: (catalog: CatalogClient) => Promise<T>
): Promise<T> {
  const client = new network.Client({
    url: socketUrl
  });

  try {
    const catalog = await CatalogClient.connect(client);
    try {
      return await fn(catalog);
    }
    finally {
      catalog.dispose();
    }
  }
  finally {
    client.destroy();
  }
}

export function e2eFolder(): string {
  return `e2e/${crypto.randomUUID()}`;
}
