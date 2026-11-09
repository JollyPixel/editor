// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { GAME_URL_PATH } from "../../../../shared/api/game.ts";
import { browser } from "../../../helpers/browser.ts";
import {
  serveBackend,
  type ServedBackend
} from "../../../helpers/studioBackend.ts";

// CONSTANTS
const kPassword = "p".repeat(43);
const kSeededMap = "map-overworld";

async function signedIn(
  backend: ServedBackend
): Promise<typeof globalThis.fetch> {
  const page = browser(new URL(`.${ACCOUNTS_URL_PATH}`, backend.url));
  await page.client.register("Alice", kPassword);

  return page.fetch;
}

function gameUrl(
  backend: ServedBackend,
  path: string
): URL {
  return new URL(`.${GAME_URL_PATH}${path}`, backend.url);
}

describe("game routes", () => {
  test("refuses a request without a session", async() => {
    await using backend = await serveBackend();

    const response = await fetch(gameUrl(backend, "?start=scene"));

    assert.equal(response.status, 401);
  });

  test("answers 404 for a start that is not a scene", async() => {
    await using backend = await serveBackend();
    const fetch = await signedIn(backend);

    const response = await fetch(gameUrl(backend, `?start=${kSeededMap}`));

    assert.equal(response.status, 404);
  });

  test("names the asset whose build fails", async() => {
    await using backend = await serveBackend();
    const fetch = await signedIn(backend);

    const response = await fetch(
      gameUrl(backend, `builds/${kSeededMap}/current/overworld.voxelmap.json`)
    );

    assert.equal(response.status, 422);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      code: "build-failed",
      message: "\"maps/overworld.voxelmap.json\" cannot be built: " +
        `Asset "${kSeededMap}" of kind "voxelmap" has no game build.`
    });
  });

  test("never throttles artifact requests", async() => {
    await using backend = await serveBackend({ requestsPerMinute: 4 });
    const fetch = await signedIn(backend);
    const artifact = gameUrl(backend, `builds/${kSeededMap}/current/map.json`);

    const statuses: number[] = [];
    for (let request = 0; request < 6; request++) {
      statuses.push((await fetch(artifact)).status);
    }

    assert.deepEqual(statuses, [422, 422, 422, 422, 422, 422]);
  });
});
