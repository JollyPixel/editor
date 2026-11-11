// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { AssetRecord } from "@jolly-pixel/asset";
import { UnbuildableAssetError } from "@jolly-pixel/asset-server";
import {
  zipSync,
  type Zippable
} from "fflate";

// Import Internal Dependencies
import type { GamePlayer } from "./BuiltPlayer.ts";
import { GameBuildError } from "./errors/GameBuildError.ts";
import { GameExportError } from "./errors/GameExportError.ts";
import type { GameBackend } from "./StudioGame.ts";
import type { StudioProject } from "../project/StudioProject.ts";
import {
  GAME_MANIFEST_FILE,
  SCENE_KIND,
  artifactSegments,
  gameManifest
} from "../../game/GameManifest.ts";

// CONSTANTS
const kFileNameSuffix = "-game.zip";

export interface GameExportOptions {
  project: Pick<StudioProject, "access" | "game" | "name" | "physics">;
  backend: GameBackend;
  player: GamePlayer;
}

export class GameExport {
  readonly fileName: string;

  #project: Pick<StudioProject, "access" | "game" | "name" | "physics">;
  #backend: GameBackend;
  #player: GamePlayer;

  constructor(
    options: GameExportOptions
  ) {
    this.#project = options.project;
    this.#backend = options.backend;
    this.#player = options.player;
    this.fileName = `${options.project.name}${kFileNameSuffix}`;
  }

  async export(
    account: Account
  ): Promise<Uint8Array> {
    this.#project.access.projectRights(account.role).require("export");
    const start = this.#start();

    const files: Zippable = Object.fromEntries(await this.#player.files());
    const records: AssetRecord[] = [];
    for (const record of this.#backend.catalog.catalog) {
      const built = await this.#backend.builds.build(record.id.value);
      if (!built.ok) {
        if (built.val instanceof UnbuildableAssetError) {
          continue;
        }

        throw new GameBuildError(record.path.toString(), built.val);
      }

      files[artifactSegments(record).join("/")] = built.val.bytes;
      records.push(record);
    }
    files[GAME_MANIFEST_FILE] = new TextEncoder().encode(
      JSON.stringify(gameManifest(start, records, this.#project.physics))
    );

    return zipSync(files);
  }

  #start(): string {
    const { start } = this.#project.game;
    const record = start === null ?
      undefined :
      this.#backend.catalog.record(start);
    if (record === undefined || !record.hasKind(SCENE_KIND)) {
      throw new GameExportError(
        "the project has no default scene: set one before exporting the game"
      );
    }

    return record.id.value;
  }
}
