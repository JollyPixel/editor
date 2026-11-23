// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { DEFAULT_PHYSICS } from "@jolly-pixel/server";

// Import Internal Dependencies
import { OfflineGameSettings } from "../../src/project/OfflineGameSettings.ts";
import { GAME_CHANGE } from "../../src/project/StudioProjectSettings.ts";

// CONSTANTS
const kMoonPhysics = {
  engine: "rapier",
  gravity: {
    x: 0,
    y: -1.62,
    z: 0
  }
} as const;

describe("OfflineGameSettings", () => {
  test("keeps the default scene and the physics for the next page of the same project", () => {
    const first = new OfflineGameSettings("offline-kept");
    const changes: string[] = [];
    first.addEventListener(GAME_CHANGE, () => changes.push(first.game.start ?? "none"));

    first.update({ game: { start: "arena" } });
    first.update({ physics: kMoonPhysics });
    const next = new OfflineGameSettings("offline-kept");
    const other = new OfflineGameSettings("offline-other");

    assert.deepEqual(changes, ["arena"]);
    assert.equal(next.game.start, "arena");
    assert.deepEqual(next.physics, kMoonPhysics);
    assert.equal(other.game.start, null);
  });

  test("starts from the project defaults when the stored record is malformed", () => {
    window.localStorage.setItem("jolly-pixel:offline-game:offline-broken", "{not json");
    const broken = new OfflineGameSettings("offline-broken");
    window.localStorage.setItem(
      "jolly-pixel:offline-game:offline-partial",
      JSON.stringify({ game: { start: "menu" }, physics: { engine: "box2d" } })
    );
    const partial = new OfflineGameSettings("offline-partial");

    assert.equal(broken.game.start, null);
    assert.deepEqual(broken.physics, DEFAULT_PHYSICS);
    assert.equal(partial.game.start, "menu");
    assert.deepEqual(partial.physics, DEFAULT_PHYSICS);
  });
});
