// Import Node.js Dependencies
import { Readable } from "node:stream";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { GameAssets } from "./GameAssets.ts";
import type { GamePlayer } from "./GamePlayer.ts";
import { GameExportError } from "./errors/GameExportError.ts";
import { ZipStream } from "./ZipStream.ts";
import type { GameBackend } from "./StudioGame.ts";
import type { StudioProject } from "../project/StudioProject.ts";
import type { GameExportAssets } from "../../project/api.ts";
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
    account: Account,
    assets: GameExportAssets
  ): Promise<Readable> {
    this.#project.access.projectRights(account.role).require("export");
    const start = this.#start();
    const player = await this.#player.files();

    return Readable.from(
      this.#zip(start, player, new GameAssets(this.#backend, assets)),
      { objectMode: false }
    );
  }

  async* #zip(
    start: string,
    player: Map<string, Uint8Array>,
    assets: GameAssets
  ): AsyncGenerator<Uint8Array> {
    const archive = new ZipStream();
    for (const [name, bytes] of player) {
      yield* archive.add(name, bytes);
    }

    const records: AssetRecord[] = [];
    for await (const { record, artifact } of assets.builds()) {
      records.push(record);
      yield* archive.add(
        artifactSegments(record).join("/"),
        artifact.bytes,
        artifact.type
      );
    }

    yield* archive.add(
      GAME_MANIFEST_FILE,
      new TextEncoder().encode(
        JSON.stringify(gameManifest(start, records, this.#project.physics))
      )
    );
    yield* archive.end();
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
