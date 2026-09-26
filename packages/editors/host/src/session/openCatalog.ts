// Import Third-party Dependencies
import { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import type { EditorSessionClient } from "./EditorSession.ts";

// CONSTANTS
export const CATALOG_TIMEOUT_MS = 5_000;

export async function openCatalog(
  client: EditorSessionClient,
  timeoutMs?: number
): Promise<CatalogClient> {
  try {
    return await CatalogClient.connect(client, { timeoutMs });
  }
  catch (error) {
    client.destroy();

    throw error;
  }
}
