// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { unzipSync } from "fflate";

// Import Internal Dependencies
import { GameBuildError } from "../../../server/game/errors/GameBuildError.ts";
import { GameExportError } from "../../../server/game/errors/GameExportError.ts";
import { GameExport } from "../../../server/game/GameExport.ts";
import { StudioGame } from "../../../server/game/StudioGame.ts";
import { ProjectRightRefusedError } from "../../../shared/errors/ProjectRightRefusedError.ts";
import {
  GAME_ACCESS,
  gameAccount,
  gameProject,
  type GameProject
} from "../../helpers/gameProject.ts";

// CONSTANTS
const kPlayerPage = "<html><script src=\"./assets/play.js\"></script></html>";

function gameExport(
  project: GameProject,
  start: string | null
): GameExport {
  return new GameExport({
    project: {
      access: GAME_ACCESS,
      game: { start }
    },
    backend: project.backend,
    player: {
      files: () => Promise.resolve(new Map([
        ["index.html", new TextEncoder().encode(kPlayerPage)],
        ["assets/play.js", new TextEncoder().encode("play()")]
      ]))
    },
    name: "Quest"
  });
}

function text(
  bytes: Uint8Array | undefined
): string | undefined {
  return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
}

describe("GameExport", () => {
  test("zips the player, game.json from the default scene and each build at its Play URL", async() => {
    await using project = await gameProject();
    const scene = await project.create("levels/arena.scene.json", "{}");
    const texture = await project.create("textures/my grass.png", "png");
    await project.create("maps/overworld.voxelmap.json", "{}");
    const exporter = gameExport(project, scene);
    const played = new StudioGame({
      project: { access: GAME_ACCESS },
      backend: project.backend
    }).manifest(gameAccount("publisher"), scene);

    const files = unzipSync(await exporter.export(gameAccount("publisher")));

    const manifest = JSON.parse(text(files["game.json"])!);
    const grass = manifest.artifacts[texture];
    assert.equal(exporter.fileName, "Quest-game.zip");
    assert.equal(manifest.start, scene);
    assert.deepEqual(
      manifest.assets.assets.map(({ path }: { path: string; }) => path).sort(),
      ["levels/arena.scene.json", "textures/my grass.png"]
    );
    assert.equal(grass, played.artifacts[texture]);
    assert.equal(text(files[decodeURIComponent(grass)]), "png");
    assert.equal(text(files["index.html"]), kPlayerPage);
    assert.equal(text(files["assets/play.js"]), "play()");
  });

  test("refuses a role without write on studio.$export", async() => {
    await using project = await gameProject();
    const scene = await project.create("levels/arena.scene.json", "{}");

    await assert.rejects(
      gameExport(project, scene).export(gameAccount("player")),
      ProjectRightRefusedError
    );
  });

  test("refuses a project whose default scene is unset or not a scene", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/grass.png", "png");

    for (const start of [null, texture, "missing"]) {
      await assert.rejects(
        gameExport(project, start).export(gameAccount("publisher")),
        GameExportError
      );
    }
  });

  test("fails on the first asset whose build fails, naming it", async() => {
    await using project = await gameProject();
    const scene = await project.create("levels/arena.scene.json", "{}");
    await project.create("scripts/Player.ts", "import \"lodash\";");

    await assert.rejects(
      gameExport(project, scene).export(gameAccount("publisher")),
      (error) => error instanceof GameBuildError &&
        error.message === "\"scripts/Player.ts\" cannot be built: \"lodash\" cannot be imported"
    );
  });
});
