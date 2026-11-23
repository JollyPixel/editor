// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import {
  CatalogShare,
  LocalPreferences,
  offlineQuery
} from "@jolly-pixel/editor.host";
import { openOfflineBackend } from "@jolly-pixel/editor.host/offline";
import {
  PLAYER_ARCHIVE_PATH,
  PLAY_PAGE_PATH,
  unzipPlayer
} from "@jolly-pixel/server";
import createHandlers from "virtual:jolly-pixel/handlers";

// Import Internal Dependencies
import { OfflineUser } from "../accounts/OfflineUser.ts";
import { OfflinePlayHost } from "../play/offline/OfflinePlayHost.ts";
import {
  registerPlayWorker,
  supportsOfflinePlay
} from "../play/offline/registerPlayWorker.ts";
import { OfflineGameSettings } from "../project/OfflineGameSettings.ts";
import { createStudioSeed } from "../../shared/seed.ts";
import type { StudioConnection } from "./StudioConnection.ts";

// CONSTANTS
const kOfflineName = "studio";
const kBlocksetUrl = "textures/blockset.png";

export async function connect(): Promise<StudioConnection> {
  const game = new OfflineGameSettings(kOfflineName);
  const backend = await openOfflineBackend({
    project: async() => {
      return {
        handlers: createHandlers(),
        seed: await loadSeed(),
        serve: (assets) => new OfflinePlayHost({
          backend: assets,
          settings: game,
          page: async() => new TextDecoder().decode(await load(PLAY_PAGE_PATH)),
          player: async() => unzipPlayer(await load(PLAYER_ARCHIVE_PATH))
        }).serve(kOfflineName)
      };
    },
    name: kOfflineName
  });
  if (supportsOfflinePlay()) {
    registerPlayWorker(document.baseURI).catch((error: unknown) => {
      console.warn("[play] the offline play worker is not registered", error);
    });
  }

  return {
    share: await CatalogShare.open(backend.connect().client),
    editorQuery: offlineQuery(kOfflineName),
    user: new OfflineUser(new LocalPreferences().preferences, game)
  };
}

async function load(
  url: string
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load "${url}" (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function loadSeed(): Promise<AssetSeedMap> {
  return createStudioSeed(await load(kBlocksetUrl));
}
