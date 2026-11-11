// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { playLoggerOptions } from "../../src/play/playLogger.ts";

describe("playLoggerOptions", () => {
  test("forwards each engine warning as one line with its details", (t) => {
    t.mock.method(console, "warn", () => undefined);
    t.mock.method(console, "log", () => undefined);
    const warnings: string[] = [];
    const logger = new Systems.Logger(
      playLoggerOptions((message) => warnings.push(message))
    );

    logger.child({ namespace: "Systems.SceneInstance" }).warn(
      "Missing asset skipped",
      {
        actor: "hero",
        type: "Model",
        assetId: "ghost"
      }
    );
    logger.child({ namespace: "Systems.World" }).info("Scene changed");
    logger.warn("Prefab cycle skipped");

    assert.deepStrictEqual(warnings, [
      "Missing asset skipped (actor: hero, type: Model, assetId: ghost)",
      "Prefab cycle skipped"
    ]);
  });
});
