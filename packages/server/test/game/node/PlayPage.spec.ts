// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PlayPage } from "#src/game/node/PlayPage.ts";
import { StudioGame } from "#src/game/node/StudioGame.ts";
import { PlayerPage } from "#src/game/PlayerPage.ts";
import { DEFAULT_PHYSICS } from "#src/project/ProjectSections.ts";
import {
  PASSED_ON_STATUS,
  listen,
  type PagesServer
} from "#src/testing.ts";
import {
  GAME_ACCESS,
  gameAccount,
  gameProject
} from "../../helpers/gameProject.ts";

// CONSTANTS
const kPage = "<html><head><script type=\"importmap\">" +
  "{\"imports\":{\"three\":\"../assets/three.js\"}}</script></head></html>";
const kSessionCookie = "session=player";

function servePlayPage(
  game: StudioGame,
  html = () => Promise.resolve(kPage)
): Promise<PagesServer> {
  const page = new PlayPage({
    page: {
      html
    },
    game,
    realm: {
      signedIn: (headers) => (headers.cookie === kSessionCookie ?
        gameAccount("player") :
        null)
    }
  });

  return listen(page.middleware);
}

describe("PlayPage", () => {
  test("maps the account's scripts to their build URLs in the player's import map", async() => {
    await using project = await gameProject();
    const script = await project.create("scripts/Player.ts", "export {};");
    const scene = await project.create("levels/arena.scene.json", "{}");
    const game = new StudioGame({
      project: {
        access: GAME_ACCESS,
        physics: DEFAULT_PHYSICS
      },
      backend: project.backend
    });
    await using server = await servePlayPage(game);

    const response = await server.fetch(`/play/?start=${scene}`, {
      headers: {
        cookie: kSessionCookie
      }
    });

    const { imports } = PlayerPage.parse(await response.text());
    const build = game.manifest(gameAccount("player"), scene).artifacts[script];
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(imports.three, "../assets/three.js");
    assert.equal(imports["../api/game/modules/scripts/Player"], `../api/game/${build}`);
  });

  test("lists no script without a session, and passes other pages on", async() => {
    await using project = await gameProject();
    await project.create("scripts/Player.ts", "export {};");
    await using server = await servePlayPage(new StudioGame({
      project: {
        access: GAME_ACCESS,
        physics: DEFAULT_PHYSICS
      },
      backend: project.backend
    }));

    const page = await server.fetch("/play/index.html");
    const other = await server.fetch("/play/assets/three.js");

    assert.equal(await page.text(), kPage);
    assert.equal(other.status, PASSED_ON_STATUS);
  });

  test("answers a page it cannot read with a 500 that names no internals", async() => {
    await using project = await gameProject();
    await using server = await servePlayPage(
      new StudioGame({
        project: {
          access: GAME_ACCESS,
          physics: DEFAULT_PHYSICS
        },
        backend: project.backend
      }),
      () => Promise.reject(new Error("ENOENT: D:/studio/play/index.html"))
    );

    const response = await server.fetch("/play/");

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.doesNotMatch(await response.text(), /ENOENT/);
  });
});
