// Import Third-party Dependencies
import {
  CATALOG_TIMEOUT_MS,
  CatalogShare,
  HOST_PARAMS,
  IDENTITY_STORAGE_KEY,
  withOfflineFallback
} from "@jolly-pixel/editor.host";
import { Client } from "@jolly-pixel/network/client";
import {
  promptPeerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";

// CONSTANTS
const kIdentityTitle = "Join studio";

export interface StudioConnection {
  share: CatalogShare;
  editorQuery: Readonly<Record<string, string>>;
  identity: PeerIdentity | null;
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
    share: await CatalogShare.open(client, {
      timeoutMs: CATALOG_TIMEOUT_MS
    }),
    editorQuery: {},
    identity
  };
}

async function connectOffline(): Promise<StudioConnection> {
  const offline = await import("./offlineConnection.ts");

  return offline.connectOffline();
}
