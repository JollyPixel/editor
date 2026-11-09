// Import Third-party Dependencies
import {
  AssetPath,
  type AssetCatalog
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import { GAME_ROUTES } from "../../shared/api/game.ts";
import { gameManifestSchema } from "../../shared/GameManifest.ts";

// CONSTANTS
const kManifestPath = new AssetPath("game.json");

export interface Game {
  readonly start: string;
  /**
   * Records at their project paths.
   */
  readonly catalog: AssetCatalog;

  resolveURL(
    url: string
  ): string;
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
    const urls = new Map<string, string>();
    for (const record of manifest.assets) {
      const artifact = manifest.artifacts[record.id.value];
      if (artifact !== undefined) {
        urls.set(
          projectPath(record.path.toString()),
          new URL(artifact, this.#endpoint.url).href
        );
      }
    }

    return {
      start: manifest.start,
      catalog: manifest.assets,
      resolveURL: (url) => urls.get(projectPath(url)) ?? url
    };
  }
}

function projectPath(
  url: string
): string {
  return URL.canParse(url) ?
    url :
    kManifestPath.resolve(url).toString();
}
