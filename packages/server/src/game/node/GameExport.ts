// Import Node.js Dependencies
import { Readable } from "node:stream";

// Import Third-party Dependencies
import type { Member } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { GameArchive } from "../GameArchive.ts";
import type { GamePlayer } from "../GamePlayer.ts";
import type { GameBackend } from "../PlayableGame.ts";
import type { Project } from "../../project/node/Project.ts";
import type { GameExportAssets } from "../api.ts";

// CONSTANTS
const kFileNameSuffix = "-game.zip";

export interface GameExportOptions {
  project: Pick<Project, "access" | "game" | "name" | "physics">;
  backend: GameBackend;
  player: GamePlayer;
}

export class GameExport {
  readonly fileName: string;

  #project: Pick<Project, "access" | "game" | "name" | "physics">;
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
    account: Member,
    assets: GameExportAssets
  ): Promise<Readable> {
    this.#project.access.projectRights(account.role).require("export");
    const archive = new GameArchive({
      backend: this.#backend,
      start: this.#project.game.start,
      physics: this.#project.physics
    });
    const player = await this.#player.bundle();

    return Readable.from(archive.zip(player, assets), { objectMode: false });
  }
}
