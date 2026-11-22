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
import { Logger } from "../../src/systems/Logger.ts";
import {
  createWorldHarness,
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
    test("should log through the logger it is given", () => {
      const log = mock.fn();
      const logger = new Logger({
        level: "debug",
        namespaces: ["host.*"],
        adapter: {
          log,
          warn: mock.fn(),
          error: mock.fn()
        }
      }).child({ namespace: "host" });
      const { world: loggedWorld } = createWorldHarness({ logger });

      loggedWorld.start();

      assert.strictEqual(loggedWorld.logger, logger);
      assert.deepEqual(log.mock.calls.map((call) => call.arguments), [
        ["[DEBUG] [host.ecs.world] Starting world"]
      ]);
    });

    test("should write every level and namespace in debug without a logger", () => {
      const { world: debugWorld } = createWorldHarness({ debug: true });

      assert.strictEqual(debugWorld.logger.isLevelEnabled("trace"), true);
      assert.strictEqual(debugWorld.logger.isNamespaceEnabled(), true);
    });
  });

  describe("draw", () => {
    test("should draw the scene manager's graph", () => {
      world.start();
      tick(kFixedDelta60);

      assert.strictEqual(renderer.draw.mock.calls[0].arguments[0], world.sceneManager.graph);
    });
  });
});
