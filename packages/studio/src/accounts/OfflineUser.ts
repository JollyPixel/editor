// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";
import {
  GAME_ROUTES,
  GAME_URL_PATH,
  ProjectRights,
  type GameExportAssets
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { ApiEndpoint } from "../api/ApiEndpoint.ts";
import { FileDownload } from "../browser/FileDownload.ts";
import { OfflinePlayClient } from "../play/offline/OfflinePlayClient.ts";
import {
  OFFLINE_PARAM,
  PLAY_ROOT
} from "../play/offline/protocol.ts";
import { supportsOfflinePlay } from "../play/offline/registerPlayWorker.ts";
import type { PlayTarget } from "../play/StudioPlay.ts";
import type { OfflineGameSettings } from "../project/OfflineGameSettings.ts";

// CONSTANTS
const kGameFileName = "game.zip";
const kOfflineRights = new ProjectRights({
  share: false,
  export: true,
  readSettings: false,
  editSettings: false,
  audit: false,
  manageAccess: false
});

export class OfflineUser extends EventTarget {
  readonly online = false;
  readonly identity = null;
  readonly account = null;
  readonly renewal = null;
  readonly project = null;
  readonly shares = null;
  readonly rights = kOfflineRights;
  readonly preferences: Preferences;
  readonly game: OfflineGameSettings;
  readonly playTarget: PlayTarget | null;

  constructor(
    preferences: Preferences,
    game: OfflineGameSettings
  ) {
    super();
    this.preferences = preferences;
    this.game = game;
    this.playTarget = supportsOfflinePlay() ?
      {
        project: game,
        query: {
          [OFFLINE_PARAM]: game.name
        }
      } :
      null;
  }

  onPreferenceError(): () => void {
    return () => undefined;
  }

  async exportGame(
    assets: GameExportAssets
  ): Promise<FileDownload> {
    const client = new OfflinePlayClient(this.game.name);
    try {
      const response = await new ApiEndpoint({
        url: new URL(`.${GAME_URL_PATH}`, PLAY_ROOT),
        fetch: client.fetch
      }).send(GAME_ROUTES.export, {
        query: { assets }
      });

      return new FileDownload(await response.blob(), kGameFileName);
    }
    finally {
      client.close();
    }
  }
}
