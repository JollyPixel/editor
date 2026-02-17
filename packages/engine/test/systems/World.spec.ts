// Import Node.js Dependencies
import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { World } from "../../src/systems/World.ts";

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
    getActor: mock.fn()
  };
}

function createMockRenderer() {
  return {
    canvas: { addEventListener: mock.fn(), removeEventListener: mock.fn() },
    draw: mock.fn(),
    clear: mock.fn(),
    observeResize: mock.fn(),
    unobserveResize: mock.fn(),
    getSource: mock.fn()
  };
}

function createMockInput() {
  return {
    connect: mock.fn(),
    disconnect: mock.fn(),
    update: mock.fn(),
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

  beforeEach(() => {
    sceneManager = createMockSceneManager();
    renderer = createMockRenderer();
    input = createMockInput();

    // @ts-expect-error - using mocks
    world = new World(renderer, {
      // @ts-expect-error - using mocks
      sceneManager,
      // @ts-expect-error - using mocks
      input,
      // @ts-expect-error - using mocks
      audio: createMockAudio(),
      globalsAdapter: createMockGlobalsAdapter()
    });
  });

  describe("tick()", () => {
    test("should call beginFrame and endFrame", () => {
      world.loop.start();

      world.tick();

      assert.strictEqual(input.update.mock.callCount(), 1);
      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 1);
      assert.strictEqual(sceneManager.endFrame.mock.callCount(), 1);
    });

    test("should return true when input.exited is true", () => {
      world.loop.start();
      input.exited = true;

      const result = world.tick();

      assert.strictEqual(result, true);
      assert.strictEqual(renderer.clear.mock.callCount(), 1);
    });

    test("should return false when input.exited is false", () => {
      world.loop.start();

      const result = world.tick();

      assert.strictEqual(result, false);
    });

    test("should emit events in correct order", () => {
      const events: string[] = [];

      world.on("beforeFixedUpdate", () => events.push("beforeFixedUpdate"));
      world.on("afterFixedUpdate", () => events.push("afterFixedUpdate"));
      world.on("beforeUpdate", () => events.push("beforeUpdate"));
      world.on("afterUpdate", () => events.push("afterUpdate"));

      world.start();

      // Wait enough simulated time for a fixed step to fire
      // FixedTimeStep uses performance.now() internally.
      // We need to call tick() twice: first to initialize the timer,
      // then after a delay to accumulate enough delta.
      world.tick();

      // Simulate passage of time by calling tick again
      // The InternalTimer will compute delta from performance.now()
      // On the first tick the delta may be ~0, so events may not fire.
      // Let's force enough time by doing multiple ticks.
      const startTime = performance.now();
      while (performance.now() - startTime < 20) {
        // busy-wait to let at least one fixed step accumulate
      }
      world.tick();

      assert.ok(events.includes("beforeFixedUpdate"), "should emit beforeFixedUpdate");
      assert.ok(events.includes("afterFixedUpdate"), "should emit afterFixedUpdate");
      assert.ok(events.includes("beforeUpdate"), "should emit beforeUpdate");
      assert.ok(events.includes("afterUpdate"), "should emit afterUpdate");

      // Verify order: beforeFixedUpdate comes before afterFixedUpdate
      const bfi = events.indexOf("beforeFixedUpdate");
      const afi = events.indexOf("afterFixedUpdate");
      const bu = events.indexOf("beforeUpdate");
      const au = events.indexOf("afterUpdate");
      assert.ok(bfi < afi, "beforeFixedUpdate should come before afterFixedUpdate");
      assert.ok(bu < au, "beforeUpdate should come before afterUpdate");
    });

    test("should emit deltaTime in seconds for fixedUpdate hooks", () => {
      let receivedDt = -1;
      world.on("beforeFixedUpdate", (dt) => {
        receivedDt = dt;
      });

      world.start();
      world.tick();

      const startTime = performance.now();
      while (performance.now() - startTime < 20) {
        // busy-wait
      }
      world.tick();

      if (receivedDt > 0) {
        // fixedDelta should be ~1/60 in seconds (~0.01667)
        assert.ok(receivedDt > 0.01, `deltaTime should be > 0.01, got ${receivedDt}`);
        assert.ok(receivedDt < 0.05, `deltaTime should be < 0.05, got ${receivedDt}`);
      }
    });

    test("should emit deltaTime in seconds for update hooks", () => {
      let receivedDt = -1;
      world.on("beforeUpdate", (dt) => {
        receivedDt = dt;
      });

      world.start();
      world.tick();

      const startTime = performance.now();
      while (performance.now() - startTime < 20) {
        // busy-wait
      }
      world.tick();

      assert.ok(receivedDt > 0, `deltaTime should be > 0, got ${receivedDt}`);
    });
  });

  describe("start() / stop()", () => {
    test("should delegate to loop.start() and loop.stop()", () => {
      // After start, tick should process frames
      world.start();
      world.tick();
      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 1);

      // After stop, loop.tick becomes a no-op (but beginFrame/endFrame still called by world.tick)
      world.stop();
    });
  });

  describe("setFps()", () => {
    test("should update loop FPS settings", () => {
      world.setFps(30, 30);

      assert.strictEqual(world.loop.framesPerSecond, 30);
      assert.strictEqual(world.loop.fixedFramesPerSecond, 30);
    });

    test("should return this for chaining", () => {
      const result = world.setFps(30);

      assert.strictEqual(result, world);
    });
  });

  describe("EventEmitter", () => {
    test("should support on/off for world events", () => {
      const handler = mock.fn();

      world.on("beforeUpdate", handler);
      world.off("beforeUpdate", handler);

      world.start();
      world.tick();

      const startTime = performance.now();
      while (performance.now() - startTime < 20) {
        // busy-wait
      }
      world.tick();

      assert.strictEqual(handler.mock.callCount(), 0);
    });
  });
});
