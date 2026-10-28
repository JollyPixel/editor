// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { World } from "../../src/systems/World.ts";
import {
  createWorldHarness,
  type WorldHarness
} from "../helpers/world/worldHarness.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

describe("Systems.World", () => {
  let world: World;
  let sceneManager: WorldHarness["sceneManager"];
  let renderer: WorldHarness["renderer"];
  let input: WorldHarness["input"];
  let scheduler: WorldHarness["scheduler"];
  let tick: WorldHarness["tick"];

  beforeEach(() => {
    ({ world, sceneManager, renderer, input, scheduler, tick } = createWorldHarness());
  });

  describe("tick()", () => {
    test("should call beginFrame and endFrame", () => {
      world.start();

      tick();

      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 1);
      assert.strictEqual(sceneManager.endFrame.mock.callCount(), 1);
    });

    test("should return true when input.exited is true", () => {
      world.start();
      input.exited = true;

      const result = tick();

      assert.strictEqual(result, true);
      assert.strictEqual(renderer.clear.mock.callCount(), 1);
    });

    test("should return false when input.exited is false", () => {
      world.start();

      assert.strictEqual(tick(), false);
    });

    test("should do nothing before start()", () => {
      assert.strictEqual(tick(16), false);

      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 0);
      assert.strictEqual(sceneManager.update.mock.callCount(), 0);
    });

    test("should run one fixed step per accumulated fixed delta", () => {
      world.start();
      tick();

      tick(70);

      const indexes = sceneManager.fixedUpdate.mock.calls
        .map(({ arguments: args }) => args[1]);
      assert.deepStrictEqual(indexes, [0, 1, 2, 3]);

      const [deltaTime] = sceneManager.fixedUpdate.mock.calls[0].arguments;
      assert.strictEqual(deltaTime, kFixedDelta60 / 1000);
    });

    test("should forward the frame delta and alpha to update()", () => {
      world.start();
      tick();

      tick(70);

      const [deltaTime, alpha] = sceneManager.update.mock.calls.at(-1)!.arguments;
      assert.strictEqual(deltaTime, 0.07);
      assert.ok(Math.abs(alpha - 0.7) < 1e-9, `alpha was ${alpha}`);
    });

    test("should keep stepping but stop drawing on a capped frame", () => {
      scheduler.maxFps = 30;
      world.start();
      tick();
      sceneManager.update.mock.resetCalls();
      renderer.draw.mock.resetCalls();

      tick(20);

      assert.strictEqual(sceneManager.fixedUpdate.mock.callCount(), 1);
      assert.strictEqual(sceneManager.update.mock.callCount(), 0);
      assert.strictEqual(renderer.draw.mock.callCount(), 0);
    });

    test("should emit events in correct order", () => {
      const events: string[] = [];

      world.start();
      tick();

      world.on("beforeFixedUpdate", () => events.push("beforeFixedUpdate"));
      world.on("afterFixedUpdate", () => events.push("afterFixedUpdate"));
      world.on("beforeUpdate", () => events.push("beforeUpdate"));
      world.on("afterUpdate", () => events.push("afterUpdate"));

      tick(20);

      assert.deepStrictEqual(events, [
        "beforeFixedUpdate",
        "afterFixedUpdate",
        "beforeUpdate",
        "afterUpdate"
      ]);
    });

    test("should emit deltaTime in seconds for fixedUpdate hooks", () => {
      let receivedDt = -1;
      world.on("beforeFixedUpdate", (dt) => {
        receivedDt = dt;
      });

      world.start();
      tick();
      tick(20);

      assert.strictEqual(receivedDt, kFixedDelta60 / 1000);
    });

    test("should emit deltaTime in seconds for update hooks", () => {
      let receivedDt = -1;
      world.on("beforeUpdate", (dt) => {
        receivedDt = dt;
      });

      world.start();
      tick();
      tick(20);

      assert.strictEqual(receivedDt, 0.02);
    });
  });

  describe("input sampling", () => {
    function recordInputOrder(): string[] {
      const order: string[] = [];
      input.sample.mock.mockImplementation(() => {
        order.push("sample");
      });
      input.publish.mock.mockImplementation((reader: string) => {
        order.push(reader);
      });
      sceneManager.fixedUpdate.mock.mockImplementation(() => {
        order.push("fixedUpdate");
      });
      sceneManager.update.mock.mockImplementation(() => {
        order.push("update");
      });

      return order;
    }

    test("should sample once, then publish before each step and the rendered update", () => {
      world.start();
      tick();
      const order = recordInputOrder();

      tick(3 * kFixedDelta60);

      assert.deepStrictEqual(order, [
        "sample",
        "step",
        "fixedUpdate",
        "step",
        "fixedUpdate",
        "step",
        "fixedUpdate",
        "frame",
        "update"
      ]);
    });

    test("should keep input pending for the next step on a frame that runs no step", () => {
      world.start();
      tick();
      const order = recordInputOrder();

      tick(1000 / 144);

      assert.deepStrictEqual(order, ["sample", "frame", "update"]);
    });
  });
});
