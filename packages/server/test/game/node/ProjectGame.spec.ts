// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GameBuildError } from "#src/game/node/errors/GameBuildError.ts";
import { ProjectGame } from "#src/game/node/ProjectGame.ts";
import { DEFAULT_PHYSICS } from "#src/project/ProjectSections.ts";
import { UnknownAssetError } from "#src/project/node/errors/UnknownAssetError.ts";
import {
  GAME_ACCESS,
  gameAccount as account,
  gameProject as openGameProject,
  type GameProject as OpenedProject
} from "../../helpers/gameProject.ts";

interface GameProject extends OpenedProject {
  readonly game: ProjectGame;
}

async function gameProject(): Promise<GameProject> {
  const project = await openGameProject();

  return Object.assign(project, {
    game: new ProjectGame({
      project: {
        access: GAME_ACCESS,
        physics: DEFAULT_PHYSICS
      },
      backend: project.backend
    })
  });
}

describe("ProjectGame", () => {
  test("lists every asset the account opens, with the path of its build", async() => {
    await using project = await gameProject();
    const scene = await project.create("levels/arena.scene.json", "{}");
    const texture = await project.create("textures/grass.png", "png");

    const player = project.game.manifest(account("player"), scene);
    const tester = project.game.manifest(account("tester"), scene);

    const revision = project.backend.catalog.record(texture)?.revision;
    assert.equal(player.start, scene);
    assert.deepEqual(
      player.assets.assets.find(({ id }) => id === texture),
      {
        id: texture,
        kind: "texture",
        path: "textures/grass.png",
        revision
      }
    );
    assert.equal(
      player.artifacts[texture],
      `builds/${texture}/${encodeURIComponent(revision!)}/grass.png`
    );
    assert.deepEqual(tester.assets.assets.map(({ id }) => id), [scene]);
    assert.deepEqual(Object.keys(tester.artifacts), [scene]);
  });

  test("starts only from a scene the account opens", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/grass.png", "png");

    assert.throws(
      () => project.game.manifest(account("player"), texture),
      UnknownAssetError
    );
    assert.throws(
      () => project.game.manifest(account("player"), "missing"),
      UnknownAssetError
    );
  });

  test("serves an artifact for good only at the current revision", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/grass.png", "png");
    const revision = project.backend.catalog.record(texture)!.revision!;

    const current = await project.game.artifact(account("player"), texture, revision);
    const stale = await project.game.artifact(account("player"), texture, "older");

    assert.equal(new TextDecoder().decode(current.bytes), "png");
    assert.equal(current.type, "image/png");
    assert.equal(current.cacheControl, "private, max-age=31536000, immutable");
    assert.equal(stale.cacheControl, "no-store");
  });

  test("serves a script's build at its module path, for good only at the current revision", async() => {
    await using project = await gameProject();
    const script = await project.create("scripts/my player.ts", "export {};");
    const revision = project.backend.catalog.record(script)!.revision!;

    const current = await project.game.module(account("player"), "scripts/my player.ts.js", revision);
    const unversioned = await project.game.module(account("player"), "scripts/my player.ts.js", undefined);

    assert.equal(new TextDecoder().decode(current.bytes), "export {};");
    assert.equal(current.type, "text/javascript");
    assert.equal(current.cacheControl, "private, max-age=31536000, immutable");
    assert.equal(unversioned.cacheControl, "no-store");
    for (const path of ["scripts/my player.ts", "scripts/my player.js"]) {
      await assert.rejects(
        project.game.module(account("player"), path, revision),
        UnknownAssetError
      );
    }
  });

  test("serves same-named TypeScript and JavaScript scripts each at its own module path", async() => {
    await using project = await gameProject();
    await project.create("scripts/util.ts", "export const typed = 1;");
    await project.create("scripts/util.js", "export const plain = 1;");

    const typed = await project.game.module(account("player"), "scripts/util.ts.js", undefined);
    const plain = await project.game.module(account("player"), "scripts/util.js.js", undefined);

    assert.equal(new TextDecoder().decode(typed.bytes), "export const typed = 1;");
    assert.equal(new TextDecoder().decode(plain.bytes), "export const plain = 1;");
  });

  test("hides an asset the account cannot open", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/grass.png", "png");

    await assert.rejects(
      project.game.artifact(account("tester"), texture, "any"),
      UnknownAssetError
    );
  });

  test("names the asset a build refuses", async() => {
    await using project = await gameProject();
    const map = await project.create("maps/overworld.voxelmap.json", "{}");

    await assert.rejects(
      project.game.artifact(account("player"), map, "any"),
      (error) => error instanceof GameBuildError &&
        error.message.startsWith("\"maps/overworld.voxelmap.json\" cannot be built")
    );
  });
});
