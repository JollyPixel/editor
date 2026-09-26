// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  CATALOG_TIMEOUT_MS,
  HOST_PARAMS,
  IDENTITY_STORAGE_KEY,
  openCatalog,
  withOfflineFallback
} from "@jolly-pixel/editor.host";
import { Client } from "@jolly-pixel/network/client";
import { promptPeerIdentity } from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";

// CONSTANTS
const kIdentityTitle = "Join studio";

export interface StudioConnection {
  catalog: CatalogClient;
  editorQuery: Readonly<Record<string, string>>;
}

export function connectStudio(): Promise<StudioConnection> {
  if (
    import.meta.env.MODE === "static" || HOST_PARAMS.read().offline
  ) {
    return connectOffline();
  }

  return withOfflineFallback({
    message: "The asset catalog is unreachable.",
    online: connectOnline,
    offline: connectOffline
  });
}

async function connectOnline(): Promise<StudioConnection> {
  const identity = await promptPeerIdentity({
    title: kIdentityTitle,
    storageKey: IDENTITY_STORAGE_KEY
  });
  const client = new Client({
    profile: toPeerMetadata(identity)
  });

  return {
    catalog: await openCatalog(client, CATALOG_TIMEOUT_MS),
    editorQuery: {}
  };
}

async function connectOffline(): Promise<StudioConnection> {
  const offline = await import("./offlineConnection.ts");

  return offline.connectOffline();
}
