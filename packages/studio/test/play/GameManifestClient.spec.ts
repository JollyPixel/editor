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
  test("loads the game of a start scene and resolves project paths to absolute build URLs", async() => {
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
            assets: [
              {
                id: "arena",
                kind: "scene",
                path: "levels/arena.scene.json",
                revision: "abc@v3"
              },
              {
                id: "ship",
                kind: "model",
                path: "models/my ship.bin"
              }
            ]
          },
          artifacts: {
            arena: "builds/arena/abc%40v3/arena.scene.json",
            ship: "builds/ship/current/my%20ship.bin"
          }
        });
      }
    });

    const game = await client.load("arena");

    assert.deepEqual(requested, [`${kGameUrl}?start=arena`]);
    assert.strictEqual(game.start, "arena");
    assert.strictEqual(game.catalog.get("arena").path.toString(), "levels/arena.scene.json");
    assert.deepEqual(
      [
        "levels/arena.scene.json",
        "models/./my ship.bin",
        "models/missing.png",
        "data:text/plain,hi"
      ].map(game.resolveURL),
      [
        `${kGameUrl}builds/arena/abc%40v3/arena.scene.json`,
        `${kGameUrl}builds/ship/current/my%20ship.bin`,
        "models/missing.png",
        "data:text/plain,hi"
      ]
    );
  });
});
