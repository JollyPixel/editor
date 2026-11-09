// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetRecord
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import { GAME_ROUTES } from "../../shared/api/game.ts";
import { gameManifestSchema } from "../../shared/GameManifest.ts";

export interface Game {
  readonly start: string;
  /**
   * Records whose paths are absolute URLs, resolved against `game.json`.
   */
  readonly catalog: AssetCatalog;
}

export class GameManifestClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  async load(
    start: string
  ): Promise<Game> {
    const manifest = await this.#endpoint.json(
      GAME_ROUTES.manifest,
      gameManifestSchema,
      {
        query: { start }
      }
    );
    const records = Array.from(
      manifest.assets,
      (record) => new AssetRecord({
        ...record.toJSON(),
        path: new URL(record.path.toString(), this.#endpoint.url).href
      })
    );

    return {
      start: manifest.start,
      catalog: new AssetCatalog(records)
    };
  }
}
