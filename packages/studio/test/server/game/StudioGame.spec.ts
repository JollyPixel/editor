// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GameBuildError } from "../../../server/game/errors/GameBuildError.ts";
import { StudioGame } from "../../../server/game/StudioGame.ts";
import { UnknownAssetError } from "../../../server/shares/errors/UnknownAssetError.ts";
import {
  GAME_ACCESS,
  gameAccount as account,
  gameProject as openGameProject,
  type GameProject as OpenedProject
} from "../../helpers/gameProject.ts";

interface GameProject extends OpenedProject {
  readonly game: StudioGame;
}

async function gameProject(): Promise<GameProject> {
  const project = await openGameProject();

  return Object.assign(project, {
    game: new StudioGame({
      project: { access: GAME_ACCESS },
      backend: project.backend
    })
  });
}

describe("StudioGame", () => {
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
