// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SceneManager } from "../../src/systems/scene/SceneManager.ts";

describe("Systems.SceneManager", () => {
  test("should emit awake event", () => {
    const sceneManager = new SceneManager();
    let eventEmitted = false;
    sceneManager.on("awake", () => {
      eventEmitted = true;
    });

    sceneManager.awake();

    assert.strictEqual(eventEmitted, true);
  });
});
