// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import type { Readable } from "node:stream";

// Import Third-party Dependencies
import {
  unzipSync,
  type Unzipped
} from "fflate";

// Import Internal Dependencies
import { GameBuildError } from "#src/node/game/errors/GameBuildError.ts";
import { GameExportError } from "#src/node/game/errors/GameExportError.ts";
import { GameExport } from "#src/node/game/GameExport.ts";
import { StudioGame } from "#src/node/game/StudioGame.ts";
import type { PhysicsSection } from "#src/project/api.ts";
import { ProjectRightRefusedError } from "#src/project/errors/ProjectRightRefusedError.ts";
import {
  GAME_ACCESS,
  gameAccount,
  gameProject,
  uses,
  type GameProject
} from "../../helpers/gameProject.ts";

// CONSTANTS
const kPlayerPage = "<html><script src=\"./assets/play.js\"></script></html>";
const kMoonPhysics: PhysicsSection = {
  engine: "rapier",
  gravity: {
    x: 0,
    y: -1.62,
    z: 0
  }
};

function gameExport(
  project: GameProject,
  start: string | null
): GameExport {
  return new GameExport({
    project: {
      access: GAME_ACCESS,
      game: { start },
      name: "Quest",
      physics: kMoonPhysics
    },
    backend: project.backend,
    player: {
      files: () => Promise.resolve(new Map([
        ["index.html", new TextEncoder().encode(kPlayerPage)],
        ["assets/play.js", new TextEncoder().encode("play()")]
      ]))
    }
  });
}

async function unzip(
  zip: Readable
): Promise<Unzipped> {
  return unzipSync(Buffer.concat(await zip.toArray()));
}

function text(
  bytes: Uint8Array | undefined
): string | undefined {
  return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
}

function exportedPaths(
  files: Unzipped
): string[] {
  const manifest = JSON.parse(text(files["game.json"])!);

  return manifest.assets.assets
    .map(({ path }: { path: string; }) => path)
    .sort();
}

describe("GameExport", () => {
  test("zips the player, game.json from the default scene and each build at its Play URL", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/my grass.png", "png");
    const map = await project.create("maps/overworld.voxelmap.json", "{}");
    const scene = await project.create(
      "levels/arena.scene.json",
      uses({ id: texture, kind: "texture" }, { id: map, kind: "voxelmap" })
    );
    const exporter = gameExport(project, scene);
    const played = new StudioGame({
      project: {
        access: GAME_ACCESS,
        physics: kMoonPhysics
      },
      backend: project.backend
    }).manifest(gameAccount("publisher"), scene);

    const files = await unzip(
      await exporter.export(gameAccount("publisher"), "reachable")
    );

    const manifest = JSON.parse(text(files["game.json"])!);
    const grass = manifest.artifacts[texture];
    assert.equal(exporter.fileName, "Quest-game.zip");
    assert.equal(manifest.start, scene);
    assert.deepEqual(exportedPaths(files), [
      "levels/arena.scene.json",
      "textures/my grass.png"
    ]);
    assert.equal(grass, played.artifacts[texture]);
    assert.deepEqual(manifest.physics, kMoonPhysics);
    assert.deepEqual(played.physics, kMoonPhysics);
    assert.equal(text(files[decodeURIComponent(grass)]), "png");
    assert.equal(text(files["index.html"]), kPlayerPage);
    assert.equal(text(files["assets/play.js"]), "play()");
  });

  test("keeps every scene and what they reach, dropping the other assets unbuilt", async() => {
    await using project = await gameProject();
    const grass = await project.create("textures/grass.png", "png");
    await project.create("textures/unused.png", "png");
    await project.create("scripts/Broken.ts", "import \"lodash\";");
    const blockset = await project.create(
      "maps/overworld.blockset.json",
      uses({ id: grass, kind: "texture" })
    );
    const scene = await project.create(
      "levels/arena.scene.json",
      uses({ id: blockset, kind: "blockset" })
    );
    await project.create("levels/secret.scene.json", "{}");

    const zip = await gameExport(project, scene).export(
      gameAccount("publisher"),
      "reachable"
    );

    assert.deepEqual(exportedPaths(await unzip(zip)), [
      "levels/arena.scene.json",
      "levels/secret.scene.json",
      "maps/overworld.blockset.json",
      "textures/grass.png"
    ]);
  });

  test("keeps the scripts a script imports and the files under a model's folder", async() => {
    await using project = await gameProject();
    await project.create("scripts/math/vector.ts", "export const zero = 0;");
    const player = await project.create(
      "scripts/Player.ts",
      "import { zero } from \"./math/vector.js\";"
    );
    const ship = await project.create("models/ship.obj", "o ship");
    await project.create("models/ship.png", "png");
    await project.create("models/textures/hull.png", "png");
    await project.create("models/Spin.ts", "export {};");
    await project.create("props/crate.png", "png");
    const scene = await project.create(
      "levels/arena.scene.json",
      uses({ id: player, kind: "script" }, { id: ship, kind: "model" })
    );

    const zip = await gameExport(project, scene).export(
      gameAccount("publisher"),
      "reachable"
    );

    assert.deepEqual(exportedPaths(await unzip(zip)), [
      "levels/arena.scene.json",
      "models/ship.obj",
      "models/ship.png",
      "models/textures/hull.png",
      "scripts/Player.ts",
      "scripts/math/vector.ts"
    ]);
  });

  test("keeps every buildable asset when asked for all of them", async() => {
    await using project = await gameProject();
    const scene = await project.create("levels/arena.scene.json", "{}");
    await project.create("textures/unused.png", "png");
    await project.create("maps/overworld.voxelmap.json", "{}");

    const zip = await gameExport(project, scene).export(
      gameAccount("publisher"),
      "all"
    );

    assert.deepEqual(exportedPaths(await unzip(zip)), [
      "levels/arena.scene.json",
      "textures/unused.png"
    ]);
  });

  test("refuses a role without write on studio.$export", async() => {
    await using project = await gameProject();
    const scene = await project.create("levels/arena.scene.json", "{}");

    await assert.rejects(
      gameExport(project, scene).export(gameAccount("player"), "reachable"),
      ProjectRightRefusedError
    );
  });

  test("refuses a project whose default scene is unset or not a scene", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/grass.png", "png");

    for (const start of [null, texture, "missing"]) {
      await assert.rejects(
        gameExport(project, start).export(
          gameAccount("publisher"),
          "reachable"
        ),
        GameExportError
      );
    }
  });

  test("stops the zip on the first reached asset whose build fails, naming it", async() => {
    await using project = await gameProject();
    const script = await project.create("scripts/Player.ts", "import \"lodash\";");
    const scene = await project.create(
      "levels/arena.scene.json",
      uses({ id: script, kind: "script" })
    );

    const zip = await gameExport(project, scene).export(
      gameAccount("publisher"),
      "reachable"
    );

    await assert.rejects(
      zip.toArray(),
      (error) => error instanceof GameBuildError &&
        error.message === "\"scripts/Player.ts\" cannot be built: \"lodash\" cannot be imported"
    );
  });
});
