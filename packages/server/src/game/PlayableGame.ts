// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import type {
  AssetBuilds,
  CatalogProjection
} from "@jolly-pixel/asset-server";
import { SCRIPT_KIND } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import { GameBuildError } from "./errors/GameBuildError.ts";
import { UnknownAssetError } from "../project/errors/UnknownAssetError.ts";
import type { PhysicsSection } from "../project/ProjectSections.ts";
import { GAME_URL_PATH } from "./api.ts";
import {
  SCENE_KIND,
  gameManifest,
  scriptImports,
  type GameManifestData
} from "./GameManifest.ts";
import { GameModule } from "./GameModule.ts";
import { PlayerPage } from "./PlayerPage.ts";

// CONSTANTS
const kGameBase = `..${GAME_URL_PATH}`;
const kImmutable = "private, max-age=31536000, immutable";
const kNoStore = "no-store";

export interface GameBackend {
  readonly catalog: CatalogProjection;
  readonly builds: AssetBuilds;
}

export interface GameArtifact {
  readonly type: string;
  readonly bytes: Uint8Array;
  readonly cacheControl: string;
}

export interface PlayableGameOptions {
  backend: GameBackend;
  physics: PhysicsSection;
  /**
   * Whether the player may load the asset.
   */
  opens: (record: AssetRecord) => boolean;
}

export class PlayableGame {
  #backend: GameBackend;
  #physics: PhysicsSection;
  #opens: (record: AssetRecord) => boolean;

  constructor(
    options: PlayableGameOptions
  ) {
    this.#backend = options.backend;
    this.#physics = options.physics;
    this.#opens = options.opens;
  }

  manifest(
    start: string
  ): GameManifestData {
    const scene = this.#readable(start);
    if (!scene.hasKind(SCENE_KIND)) {
      throw new UnknownAssetError(start);
    }

    return gameManifest(start, this.#records(), this.#physics);
  }

  scriptImports(
    base: string
  ): Record<string, string> {
    return scriptImports(this.#records(), base);
  }

  playPage(
    html: string
  ): string {
    return PlayerPage.parse(html)
      .withImports(this.scriptImports(kGameBase))
      .toString();
  }

  async artifact(
    assetId: string,
    revision: string | undefined
  ): Promise<GameArtifact> {
    const record = this.#readable(assetId);
    const built = await this.#backend.builds.build(assetId);
    if (!built.ok) {
      throw new GameBuildError(record.path.toString(), built.val);
    }

    return {
      type: built.val.type,
      bytes: built.val.bytes,
      cacheControl: record.revision === revision ? kImmutable : kNoStore
    };
  }

  module(
    path: string,
    revision: string | undefined
  ): Promise<GameArtifact> {
    const script = GameModule.parse(path)?.script;
    const record = script === undefined ?
      undefined :
      this.#backend.catalog.catalog.findByPath(script);
    if (record === undefined || !record.hasKind(SCRIPT_KIND)) {
      return Promise.reject(new UnknownAssetError(path));
    }

    return this.artifact(record.id.value, revision);
  }

  #records(): AssetRecord[] {
    return Array.from(this.#backend.catalog.catalog)
      .filter((record) => this.#opens(record));
  }

  #readable(
    assetId: string
  ): AssetRecord {
    const record = this.#backend.catalog.record(assetId);
    if (record === undefined || !this.#opens(record)) {
      throw new UnknownAssetError(assetId);
    }

    return record;
  }
}
