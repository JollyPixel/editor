// Import Third-party Dependencies
import {
  CATALOG_ROOM,
  CatalogClient
} from "@jolly-pixel/asset-server/catalog/client";

// Import Internal Dependencies
import type { EditorSessionClient } from "./EditorSession.ts";
import { CatalogUnavailableError } from "./errors/CatalogUnavailableError.ts";

// CONSTANTS
export const CATALOG_TIMEOUT_MS = 5_000;

export async function openCatalog(
  client: EditorSessionClient,
  timeoutMs?: number
): Promise<CatalogClient> {
  const catalog = new CatalogClient(
    client.room(CATALOG_ROOM)
  );
  try {
    await (timeoutMs === undefined ?
      catalog.ready :
      readyWithin(catalog.ready, timeoutMs));
  }
  catch (error) {
    catalog.dispose();
    client.destroy();

    throw error;
  }

  return catalog;
}

async function readyWithin(
  ready: Promise<void>,
  timeoutMs: number
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ready,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new CatalogUnavailableError()),
          timeoutMs
        );
      })
    ]);
  }
  finally {
    clearTimeout(timer);
  }
}
