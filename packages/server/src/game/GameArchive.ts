// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { GameAssets } from "./GameAssets.ts";
import type { PlayerBundle } from "./GamePlayer.ts";
import { GameExportError } from "./errors/GameExportError.ts";
import { GamePlayerError } from "./errors/GamePlayerError.ts";
import { ZipStream } from "./ZipStream.ts";
import type { GameBackend } from "./PlayableGame.ts";
import type { GameExportAssets } from "./api.ts";
import {
  EDITOR_PAGE_FILE,
  PLAY_PAGE_PATH
} from "../editors/EditorDescriptor.ts";
import {
  GAME_MANIFEST_FILE,
  GAME_MANIFEST_META,
  SCENE_KIND,
  artifactPath,
  gameManifest,
  scriptImports
} from "./GameManifest.ts";
import { PlayerPage } from "./PlayerPage.ts";
import { insertInHead } from "../http/insertInHead.ts";
import type { PhysicsSection } from "../project/ProjectSections.ts";

// CONSTANTS
const kExportBase = "./";
const kParentReference = /\b(src|href)="\.\.\//g;
const kParentAddress = /^\.\.\//;
const kGameMeta = `<meta name="${GAME_MANIFEST_META}" content="exported">`;

export interface GameArchiveOptions {
  backend: GameBackend;
  /**
   * The default scene.
   */
  start: string | null;
  physics: PhysicsSection;
}

export class GameArchive {
  #backend: GameBackend;
  #start: string;
  #physics: PhysicsSection;

  constructor(
    options: GameArchiveOptions
  ) {
    const { backend, start } = options;
    const record = start === null ? undefined : backend.catalog.record(start);
    if (record === undefined || !record.hasKind(SCENE_KIND)) {
      throw new GameExportError(
        "the project has no default scene: set one before exporting the game"
      );
    }

    this.#backend = backend;
    this.#start = record.id.value;
    this.#physics = options.physics;
  }

  zip(
    player: PlayerBundle,
    assets: GameExportAssets
  ): AsyncGenerator<Uint8Array> {
    return this.#zip(
      exportedPlayerPage(player.page),
      player.files,
      new GameAssets(this.#backend, assets)
    );
  }

  async* #zip(
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
        artifactPath(record).file,
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
        JSON.stringify(gameManifest(this.#start, records, this.#physics))
      )
    );
    yield* archive.end();
  }
}

function exportedPlayerPage(
  page: string
): PlayerPage {
  if (page.search(kParentReference) === -1) {
    throw new GamePlayerError(
      `the built ${PLAY_PAGE_PATH} loads nothing from ../`
    );
  }

  const player = PlayerPage.parse(insertInHead(
    page.replace(kParentReference, "$1=\"./"),
    kGameMeta
  ));

  return player.withImports(Object.fromEntries(
    Object.entries(player.imports).map(
      ([specifier, url]) => [specifier, url.replace(kParentAddress, "./")]
    )
  ));
}
