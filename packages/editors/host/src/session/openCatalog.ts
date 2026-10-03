// Import Third-party Dependencies
import {
  CatalogClient,
  type CatalogConnectOptions
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type { EditorSessionClient } from "./EditorSession.ts";

// CONSTANTS
export const CATALOG_TIMEOUT_MS = 5_000;

export type CatalogOpener = (
  client: EditorSessionClient,
  options: CatalogConnectOptions
) => Promise<CatalogClient>;

export async function openCatalog(
  client: EditorSessionClient,
  timeoutMs?: number,
  open: CatalogOpener = connectCatalog
): Promise<CatalogClient> {
  try {
    return await open(client, { timeoutMs });
  }
  catch (error) {
    client.destroy();

    throw error;
  }
}

function connectCatalog(
  client: EditorSessionClient,
  options: CatalogConnectOptions
): Promise<CatalogClient> {
  return CatalogClient.connect(client, options);
}
