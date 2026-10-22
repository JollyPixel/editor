// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import {
  CatalogShare,
  LocalPreferences,
  offlineQuery
} from "@jolly-pixel/editor.host";
import { openOfflineBackend } from "@jolly-pixel/editor.host/offline";
import createHandlers from "virtual:jolly-pixel/handlers";

// Import Internal Dependencies
import { OfflineUser } from "../accounts/OfflineUser.ts";
import type { StudioConnection } from "./StudioConnection.ts";
import { createStudioSeed } from "../../shared/seed.ts";

// CONSTANTS
const kOfflineName = "studio";
const kBlocksetUrl = "textures/blockset.png";

export async function connect(): Promise<StudioConnection> {
  const backend = await openOfflineBackend({
    project: async() => {
      return {
        handlers: createHandlers(),
        seed: await loadSeed()
      };
    },
    name: kOfflineName
  });

  return {
    share: await CatalogShare.open(backend.connect().client),
    editorQuery: offlineQuery(kOfflineName),
    user: new OfflineUser(new LocalPreferences().preferences)
  };
}

async function loadSeed(): Promise<AssetSeedMap> {
  const response = await fetch(kBlocksetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load "${kBlocksetUrl}" (${response.status}).`);
  }

  return createStudioSeed(
    new Uint8Array(await response.arrayBuffer())
  );
}
