// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/preferences";
import {
  PlayerPage,
  type GameSection,
  type PhysicsSection,
  type PlayerBundle
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { OfflineUser } from "../../../src/accounts/OfflineUser.ts";
import { OfflinePlayClient } from "../../../src/play/offline/OfflinePlayClient.ts";
import { OfflinePlayHost } from "../../../src/play/offline/OfflinePlayHost.ts";
import {
  PLAY_ACCEPTED,
  PLAY_TIMEOUT_MS,
  playChannelName
} from "../../../src/play/offline/protocol.ts";
import { OfflineGameSettings } from "../../../src/project/OfflineGameSettings.ts";
import {
  offlineGame,
  type OfflineGame
} from "../../helpers/offlineGame.ts";

// CONSTANTS
const kPage = "<html><head></head><body></body></html>";
const kMoonPhysics: PhysicsSection = {
  engine: "rapier",
  gravity: {
    x: 0,
    y: -1.62,
    z: 0
  }
};

interface PlaySession extends AsyncDisposable {
  readonly offline: string;
  readonly game: OfflineGame;
  readonly client: OfflinePlayClient;
  readonly stop: () => void;
  readonly settings: {
    game: GameSection;
    physics: PhysicsSection;
  };
}

let sessions = 0;

function builtPlayer(): Promise<PlayerBundle> {
  return Promise.resolve({
    page: "<script type=\"module\" src=\"../assets/play.js\"></script>",
    files: new Map([
      ["assets/play.js", new TextEncoder().encode("play()")]
    ])
  });
}

async function playSession(
  player: () => Promise<PlayerBundle> = builtPlayer
): Promise<PlaySession> {
  const offline = `offline-play-${++sessions}`;
  const game = await offlineGame();
  const settings: PlaySession["settings"] = {
    game: { start: null },
    physics: kMoonPhysics
  };
  const stop = new OfflinePlayHost({
    backend: game.backend,
    settings,
    page: () => Promise.resolve(kPage),
    player
  }).serve(offline);
  const client = new OfflinePlayClient(offline);

  return {
    offline,
    game,
    client,
    stop,
    settings,
    async [Symbol.asyncDispose]() {
      client.close();
      stop();
      await game[Symbol.asyncDispose]();
    }
  };
}

describe("offline Play", () => {
  test("serves the play page with an import map of the project's scripts", async() => {
    await using session = await playSession();
    const script = await session.game.create("scripts/Player.ts", "export {};");

    const response = await session.client.request("play/?start=arena&offline=studio");

    assert.equal(response.status, 200);
    assert.equal(
      PlayerPage.parse(await response.text()).imports["../api/game/modules/scripts/Player"],
      `../api/game/modules/scripts/Player.ts.js?revision=${session.game.revision(script)}`
    );
  });

  test("serves the played scene's manifest with the offline physics, and each build at its URL", async() => {
    await using session = await playSession();
    const scene = await session.game.create("levels/arena.scene.json", "{}");
    const texture = await session.game.create("textures/grass.png", "png");

    const manifest = await (await session.client.request(
      `api/game/?start=${scene}`
    )).json();
    const build = await session.client.request(
      `api/game/${manifest.artifacts[texture]}`
    );

    assert.equal(manifest.start, scene);
    assert.deepEqual(manifest.physics, kMoonPhysics);
    assert.equal(build.status, 200);
    assert.equal(build.headers.get("content-type"), "image/png");
    assert.equal(
      build.headers.get("cache-control"),
      "private, max-age=31536000, immutable"
    );
    assert.equal(await build.text(), "png");
  });

  test("serves a script's build at its module path", async() => {
    await using session = await playSession();
    await session.game.create("scripts/my player.ts", "export const speed = 1;");

    const response = await session.client.request(
      "api/game/modules/scripts/my%20player.ts.js?revision=older"
    );

    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "export const speed = 1;");
  });

  test("answers a refused build as build-failed and a missing asset as not-found", async() => {
    await using session = await playSession();
    await session.game.create("scripts/Bad.ts", "import \"lodash\";");

    const refused = await session.client.request("api/game/modules/scripts/Bad.ts.js");
    const missing = await session.client.request("api/game/?start=missing");

    assert.equal(refused.status, 422);
    assert.equal((await refused.json()).code, "build-failed");
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).code, "not-found");
  });

  test("exports the game only once a default scene is set", async() => {
    await using session = await playSession();
    const scene = await session.game.create("levels/arena.scene.json", "{}");

    const refused = await session.client.request("api/game/export");
    session.settings.game = { start: scene };
    const exported = await session.client.request("api/game/export?assets=all");

    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).code, "not-exportable");
    assert.equal(exported.status, 200);
    assert.equal(exported.headers.get("content-type"), "application/zip");
    assert.equal(
      new TextDecoder().decode((await exported.bytes()).slice(0, 2)),
      "PK"
    );
  });

  test("downloads the exported game for the offline studio user", async() => {
    await using session = await playSession();
    session.settings.game = {
      start: await session.game.create("levels/arena.scene.json", "{}")
    };
    const game = new OfflineGameSettings(session.offline);
    const user = new OfflineUser(new Preferences(), game);

    const download = await user.exportGame("reachable");

    assert.equal(download.fileName, "game.zip");
    assert.equal(download.blob.type, "application/zip");
  });

  test("answers project-unavailable when no studio tab serves the project", async(context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const client = new OfflinePlayClient("offline-play-nobody");
    try {
      const pending = client.request("api/game/?start=arena");
      context.mock.timers.tick(PLAY_TIMEOUT_MS);
      const response = await pending;

      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "project-unavailable");
    }
    finally {
      client.close();
    }
  });

  test("answers project-unavailable when the serving tab closes before it replies", async(context) => {
    const exporting = Promise.withResolvers<void>();
    await using session = await playSession(() => {
      exporting.resolve();

      return Promise.withResolvers<PlayerBundle>().promise;
    });
    session.settings.game = {
      start: await session.game.create("levels/arena.scene.json", "{}")
    };
    const observer = new BroadcastChannel(playChannelName(session.offline));
    const accepted = Promise.withResolvers<void>();
    observer.addEventListener("message", (event) => {
      if (event.data.type === PLAY_ACCEPTED) {
        accepted.resolve();
      }
    });
    context.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const pending = session.client.request("api/game/export");
      await Promise.all([exporting.promise, accepted.promise]);
      session.stop();
      context.mock.timers.tick(PLAY_TIMEOUT_MS);
      const response = await pending;

      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "project-unavailable");
    }
    finally {
      observer.close();
    }
  });
});
