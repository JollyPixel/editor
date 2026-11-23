// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseGameRequest } from "#src/game/GameRequest.ts";

describe("parseGameRequest", () => {
  test("reads each game route with its validated params and query", () => {
    const cases = [
      {
        url: "?start=arena",
        expected: { route: "manifest", query: { start: "arena" } }
      },
      {
        url: "builds/grass/r1/grass%20tile.png",
        expected: {
          route: "artifact",
          params: { assetId: "grass", revision: "r1", name: "grass tile.png" }
        }
      },
      {
        url: "modules/scripts/my%20player.ts.js?revision=r2",
        expected: {
          route: "module",
          params: { "*": "scripts/my player.ts.js" },
          query: { revision: "r2" }
        }
      },
      {
        url: "export",
        expected: { route: "export", query: { assets: "reachable" } }
      }
    ];

    for (const { url, expected } of cases) {
      const { pathname, searchParams } = new URL(url, "http://game.invalid/");

      assert.deepEqual(
        parseGameRequest(pathname.slice(1), searchParams),
        expected,
        url
      );
    }
  });

  test("refuses an unknown path and a route whose params fail their schema", () => {
    for (const url of ["", "builds//r1/grass.png", "builds/grass/r1", "scores"]) {
      const { pathname, searchParams } = new URL(url, "http://game.invalid/");

      assert.equal(parseGameRequest(pathname.slice(1), searchParams), null, url);
    }
  });
});
