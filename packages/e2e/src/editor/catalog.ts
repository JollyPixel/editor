// Import Node.js Dependencies
import crypto from "node:crypto";

// Import Third-party Dependencies
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import * as network from "@jolly-pixel/network/client";
import { CatalogClient } from "@jolly-pixel/asset-server/client";

export async function withCatalog<T>(
  baseURL: string,
  fn: (catalog: CatalogClient) => Promise<T>
): Promise<T> {
  const client = new network.Client({
    socket: () => network.connectWebSocket({ url: syncSocketUrl(baseURL) })
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

function syncSocketUrl(
  baseURL: string
): string {
  const url = new URL(DEFAULT_WEBSOCKET_PATH, baseURL);
  url.protocol = "ws:";

  return url.href;
}
