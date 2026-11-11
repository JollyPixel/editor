// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  DEFAULT_PHYSICS,
  type PhysicsSection
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { GameManifestClient } from "../../src/play/GameManifestClient.ts";

// CONSTANTS
const kGameUrl = "http://localhost/studio/api/game/";
const kMoonPhysics: PhysicsSection = {
  engine: "rapier",
  gravity: {
    x: 0,
    y: -1.62,
    z: 0
  }
};

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
          },
          physics: kMoonPhysics
        });
      }
    });

    const game = await client.load("arena");

    assert.deepEqual(requested, [`${kGameUrl}?start=arena`]);
    assert.strictEqual(game.start, "arena");
    assert.strictEqual(game.catalog.get("arena").path.toString(), "levels/arena.scene.json");
    assert.deepEqual(game.physics, kMoonPhysics);
    assert.deepEqual(
      [
        "levels/arena.scene.json",
        "models/./my ship.bin",
        "models/my%20ship.bin",
        "models/missing.png",
        "data:text/plain,hi"
      ].map(game.resolveURL),
      [
        `${kGameUrl}builds/arena/abc%40v3/arena.scene.json`,
        `${kGameUrl}builds/ship/current/my%20ship.bin`,
        `${kGameUrl}builds/ship/current/my%20ship.bin`,
        "models/missing.png",
        "data:text/plain,hi"
      ]
    );
  });

  test("loads an exported game.json and resolves its artifacts beside it", async() => {
    const requested: string[] = [];
    const client = new GameManifestClient({
      url: "http://localhost/quest/",
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
                path: "levels/arena.scene.json"
              }
            ]
          },
          artifacts: {
            arena: "builds/arena/current/arena.scene.json"
          },
          physics: DEFAULT_PHYSICS
        });
      }
    });

    const game = await client.loadExported();

    assert.deepEqual(requested, ["http://localhost/quest/game.json"]);
    assert.strictEqual(game.start, "arena");
    assert.strictEqual(
      game.resolveURL("levels/arena.scene.json"),
      "http://localhost/quest/builds/arena/current/arena.scene.json"
    );
  });
});
