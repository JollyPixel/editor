// Import Node.js Dependencies
import { Readable } from "node:stream";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { GameAssets } from "./GameAssets.ts";
import type { GamePlayer } from "./GamePlayer.ts";
import { GameExportError } from "./errors/GameExportError.ts";
import { GamePlayerError } from "./errors/GamePlayerError.ts";
import { ZipStream } from "./ZipStream.ts";
import type { GameBackend } from "./StudioGame.ts";
import type { StudioProject } from "../project/StudioProject.ts";
import type { GameExportAssets } from "../../project/api.ts";
import {
  EDITOR_PAGE_FILE,
  PLAY_PAGE_PATH
} from "../../editors/EditorDescriptor.ts";
import {
  GAME_MANIFEST_FILE,
  GAME_MANIFEST_META,
  SCENE_KIND,
  artifactSegments,
  gameManifest,
  scriptImports
} from "../../game/GameManifest.ts";
import { PlayerPage } from "../../game/PlayerPage.ts";

// CONSTANTS
const kFileNameSuffix = "-game.zip";
const kExportBase = "./";
const kParentReference = /\b(src|href)="\.\.\//g;
const kParentAddress = /^\.\.\//;
const kHeadEnd = "</head>";
const kGameMeta = `<meta name="${GAME_MANIFEST_META}" content="exported">`;

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
    const player = await this.#player.bundle();

    return Readable.from(
      this.#zip(
        start,
        exportedPlayerPage(player.page),
        player.files,
        new GameAssets(this.#backend, assets)
      ),
      { objectMode: false }
    );
  }

  async* #zip(
    start: string,
    page: PlayerPage,
    files: ReadonlyMap<string, Uint8Array>,
    assets: GameAssets
  ): AsyncGenerator<Uint8Array> {
    const archive = new ZipStream();
    for (const [name, bytes] of files) {
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
      EDITOR_PAGE_FILE,
      new TextEncoder().encode(
        page.withImports(scriptImports(records, kExportBase)).toString()
      )
    );
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

function exportedPlayerPage(
  page: string
): PlayerPage {
  if (page.search(kParentReference) === -1 || !page.includes(kHeadEnd)) {
    throw new GamePlayerError(
      `the built ${PLAY_PAGE_PATH} loads nothing from ../ or has no ${kHeadEnd}`
    );
  }

  const player = PlayerPage.parse(page
    .replace(kParentReference, "$1=\"./")
    .replace(kHeadEnd, `  ${kGameMeta}\n${kHeadEnd}`));

  return player.withImports(Object.fromEntries(
    Object.entries(player.imports).map(
      ([specifier, url]) => [specifier, url.replace(kParentAddress, "./")]
    )
  ));
}
