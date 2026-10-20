// Import Third-party Dependencies
import {
  CatalogShare,
  LocalPreferences,
  offlineQuery
} from "@jolly-pixel/editor.host";
import { openOfflineBackend } from "@jolly-pixel/editor.host/offline";
import createHandlers from "virtual:jolly-pixel/handlers";

// Import Internal Dependencies
import type { StudioConnection } from "./connection.ts";
import { loadStudioSeed } from "./seed.ts";

// CONSTANTS
const kOfflineName = "studio";

export async function connectOffline(): Promise<StudioConnection> {
  const backend = await openOfflineBackend({
    project: async() => {
      return {
        handlers: createHandlers(),
        seed: await loadStudioSeed()
      };
    },
    name: kOfflineName
  });

  return {
    share: await CatalogShare.open(backend.connect().client),
    editorQuery: offlineQuery(kOfflineName),
    signedIn: null,
    preferences: new LocalPreferences().preferences
  };
}
