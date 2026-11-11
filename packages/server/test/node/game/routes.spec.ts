// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { GAME_URL_PATH } from "#src/game/api.ts";
import {
  browser,
  type ServedBackend
} from "#src/testing.ts";
import { serveBackend } from "../../helpers/studioBackend.ts";

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

  test("serves the build of an asset, never cached at a revision that is not current", async() => {
    await using backend = await serveBackend();
    const fetch = await signedIn(backend);

    const response = await fetch(
      gameUrl(backend, `builds/${kSeededMap}/stale/overworld.voxelmap.json`)
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.partialDeepStrictEqual(await response.json(), {
      blocksets: [{
        asset: {
          id: "blockset-overworld",
          kind: "blockset"
        }
      }]
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

    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200]);
  });
});
