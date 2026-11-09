// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GameManifestClient } from "../../src/play/GameManifestClient.ts";

// CONSTANTS
const kGameUrl = "http://localhost/studio/api/game/";

describe("GameManifestClient", () => {
  test("loads the game of a start scene with absolute artifact URLs", async() => {
    const requested: string[] = [];
    const client = new GameManifestClient({
      url: kGameUrl,
      fetch: async(input) => {
        requested.push(String(input));

        return Response.json({
          version: 1,
          start: "arena",
          assets: {
            version: 1,
            assets: [{
              id: "arena",
              kind: "scene",
              path: "builds/arena/abc%40v3/arena.scene.json",
              revision: "abc@v3"
            }]
          }
        });
      }
    });

    const game = await client.load("arena");

    assert.deepStrictEqual(requested, [`${kGameUrl}?start=arena`]);
    assert.strictEqual(game.start, "arena");
    assert.strictEqual(
      game.catalog.get("arena").path.toString(),
      `${kGameUrl}builds/arena/abc%40v3/arena.scene.json`
    );
    assert.strictEqual(game.catalog.get("arena").revision, "abc@v3");
  });
});
