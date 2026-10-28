// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { World } from "../../src/systems/World.ts";
import {
  createWorldHarness,
  SCENE_SOURCE,
  type WorldHarness
} from "../helpers/world/worldHarness.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

describe("Systems.World", () => {
  let world: World;
  let renderer: WorldHarness["renderer"];
  let tick: WorldHarness["tick"];

  beforeEach(() => {
    ({ world, renderer, tick } = createWorldHarness());
  });

  describe("frame requests", () => {
    test("invalidate() emits invalidate", () => {
      const handler = mock.fn();
      world.on("invalidate", handler);

      world.invalidate();

      assert.strictEqual(handler.mock.callCount(), 1);
    });

    test("animating holds while any keep-alive predicate does", () => {
      let first = false;
      let second = false;
      world.keepAlive(() => first);
      const release = world.keepAlive(() => second);
      assert.strictEqual(world.animating, false);

      second = true;
      assert.strictEqual(world.animating, true);

      release();
      assert.strictEqual(world.animating, false);

      first = true;
      assert.strictEqual(world.animating, true);
    });

    test("keepAlive() requests a frame", () => {
      const handler = mock.fn();
      world.on("invalidate", handler);

      world.keepAlive(() => false);

      assert.strictEqual(handler.mock.callCount(), 1);
    });
  });

  describe("logger", () => {
    test("should let explicit logger options override the debug defaults", () => {
      const { world: debugWorld } = createWorldHarness({
        debug: true,
        logger: { level: "warn" }
      });

      assert.strictEqual(debugWorld.logger.level, "warn");
      assert.strictEqual(debugWorld.logger.isNamespaceEnabled(), true);
    });
  });

  describe("draw", () => {
    test("should draw the scene manager's scene", () => {
      world.start();
      tick(kFixedDelta60);

      assert.strictEqual(renderer.draw.mock.calls[0].arguments[0], SCENE_SOURCE);
    });
  });
});
