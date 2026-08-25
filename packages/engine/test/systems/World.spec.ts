// Import Node.js Dependencies
import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { FrameScheduler } from "@jolly-pixel/loop";

// Import Internal Dependencies
import { World } from "../../src/systems/World.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

function createMockSceneManager() {
  return {
    tree: { add: mock.fn(), remove: mock.fn() },
    componentsToBeStarted: [],
    componentsToBeDestroyed: [],
    getSource: mock.fn(),
    awake: mock.fn(),
    beginFrame: mock.fn(),
    update: mock.fn(),
    fixedUpdate: mock.fn(),
    endFrame: mock.fn(),
    destroyActor: mock.fn(),
    registerActor: mock.fn(),
    unregisterActor: mock.fn(),
    getActor: mock.fn(),
    bindWorld: mock.fn()
  };
}

function createMockRenderer() {
  return {
    canvas: { addEventListener: mock.fn(), removeEventListener: mock.fn() },
    draw: mock.fn(),
    clear: mock.fn(),
    observeResize: mock.fn(),
    unobserveResize: mock.fn(),
    getSource: mock.fn(),
    dispose: mock.fn()
  };
}

function createMockInput() {
  return {
    connect: mock.fn(),
    disconnect: mock.fn(),
    update: mock.fn(),
    publishFrameState: mock.fn(),
    exited: false
  };
}

function createMockAudio() {
  return {
    listener: {},
    setVolume: mock.fn(),
    getVolume: mock.fn()
  };
}

function createMockGlobalsAdapter() {
  return {
    setGame: mock.fn()
  };
}

describe("Systems.World", () => {
  let world: World;
  let sceneManager: ReturnType<typeof createMockSceneManager>;
  let renderer: ReturnType<typeof createMockRenderer>;
  let input: ReturnType<typeof createMockInput>;
  // The world neither reads a clock nor owns a scheduler, so the test owns
  // both: it decides the frame, the world executes it.
  let now: number;
  let scheduler: FrameScheduler;

  function tick(
    deltaMs = 0
  ): boolean {
    now += deltaMs;

    return world.tick(scheduler.advance(now));
  }

  beforeEach(() => {
    sceneManager = createMockSceneManager();
    renderer = createMockRenderer();
    input = createMockInput();
    now = 0;
    scheduler = new FrameScheduler();

    // @ts-expect-error - using mocks
    world = new World(renderer, {
      sceneManager,
      input,
      audio: createMockAudio(),
      assetCoordinator: {},
      globalsAdapter: createMockGlobalsAdapter()
    });
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

      // 80ms is four steps of 16.66ms, plus change.
      tick(80);

      const indexes = sceneManager.fixedUpdate.mock.calls
        .map(({ arguments: args }) => args[1]);
      assert.deepStrictEqual(indexes, [0, 1, 2, 3]);

      const [deltaTime] = sceneManager.fixedUpdate.mock.calls[0].arguments;
      assert.strictEqual(deltaTime, kFixedDelta60 / 1000);
    });

    test("should forward the frame delta and alpha to update()", () => {
      world.start();
      tick();

      tick(80);

      const [deltaTime, alpha] = sceneManager.update.mock.calls.at(-1)!.arguments;
      assert.strictEqual(deltaTime, 0.08);
      // 80ms leaves 13.33ms in the accumulator, four fifths of a step.
      assert.ok(Math.abs(alpha - 0.8) < 1e-9, `alpha was ${alpha}`);
    });

    test("should keep stepping but stop drawing on a capped frame", () => {
      scheduler.maxFps = 30;
      world.start();
      // The first frame always draws: it primes the scheduler.
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
    test("should sample input once per fixed step", () => {
      world.start();
      tick();
      input.update.mock.resetCalls();

      // Three steps: the first sees the press edge, the next two diff against
      // it and correctly do not, so a jump fires once rather than three times.
      tick(3 * kFixedDelta60);

      assert.strictEqual(sceneManager.fixedUpdate.mock.callCount(), 3);
      assert.strictEqual(input.update.mock.callCount(), 3);
    });

    test("should sample input once on a frame that runs no step", () => {
      world.start();
      tick();
      input.update.mock.resetCalls();

      // A 144Hz frame against a 60Hz simulation: no step is due.
      tick(1000 / 144);

      assert.strictEqual(sceneManager.fixedUpdate.mock.callCount(), 0);
      assert.strictEqual(input.update.mock.callCount(), 1);
    });

    test("should publish accumulated input before the rendered update", () => {
      const order: string[] = [];
      input.publishFrameState.mock.mockImplementation(() => {
        order.push("input");
      });
      sceneManager.update.mock.mockImplementation(() => {
        order.push("scene");
      });
      world.start();

      tick();

      assert.deepStrictEqual(order, ["input", "scene"]);
    });

    test("should sample before the step that reads the sample", () => {
      const stepsWhenSampled: number[] = [];
      input.update.mock.mockImplementation(() => {
        stepsWhenSampled.push(sceneManager.fixedUpdate.mock.callCount());
      });

      world.start();
      tick();
      tick(1000 / 144);
      tick(1000 / 144);
      tick(1000 / 144);

      // Every sample lands before the step it feeds, never after it, so no
      // edge is diffed away before a step has seen it.
      assert.deepStrictEqual(stepsWhenSampled, [0, 0, 0, 0]);
      assert.strictEqual(sceneManager.fixedUpdate.mock.callCount(), 1);
    });
  });

  describe("start() / stop()", () => {
    test("should gate ticking", () => {
      world.start();
      assert.strictEqual(world.running, true);
      tick(20);
      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 1);

      world.stop();
      assert.strictEqual(world.running, false);
      tick(20);
      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 1);
    });
  });

  describe("dispose()", () => {
    test("should release the renderer, which owns the WebGL context", () => {
      world.dispose();

      assert.strictEqual(renderer.dispose.mock.callCount(), 1);
    });

    test("should disconnect before releasing the renderer", () => {
      world.connect();

      world.dispose();

      assert.strictEqual(input.disconnect.mock.callCount(), 1);
      assert.strictEqual(renderer.unobserveResize.mock.callCount(), 1);
    });

    test("should stop the loop", () => {
      world.start();

      world.dispose();
      tick(20);

      assert.strictEqual(
        sceneManager.update.mock.callCount(),
        0,
        "a stopped loop must not keep driving the scene"
      );
    });
  });

  describe("scheduling", () => {
    test("should run whatever the caller's scheduler decided", () => {
      scheduler.fixedFps = 30;
      scheduler.timeScale = 0.5;

      world.start();
      tick();
      // Half speed: 100ms of wall clock is 50ms of simulation, one step of
      // 33.3ms with the remainder left in the accumulator.
      tick(100);

      assert.strictEqual(sceneManager.fixedUpdate.mock.callCount(), 1);
    });

    test("should not advance a scheduler of its own", () => {
      world.start();
      // Two ticks off the same schedule run twice: the world holds no
      // accumulator, so replaying one is not de-duplicated.
      const schedule = scheduler.advance(0);
      world.tick(schedule);
      world.tick(schedule);

      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 2);
      assert.strictEqual(scheduler.frameCount, 1);
    });
  });

  describe("EventEmitter", () => {
    test("should support on/off for world events", () => {
      const handler = mock.fn();

      world.on("beforeUpdate", handler);
      world.off("beforeUpdate", handler);

      world.start();
      tick();
      tick(20);

      assert.strictEqual(handler.mock.callCount(), 0);
    });
  });
});
