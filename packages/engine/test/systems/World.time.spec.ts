// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { FrameScheduler } from "@jolly-pixel/loop";

// Import Internal Dependencies
import { World } from "../../src/systems/World.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;
const kScene = { isScene: true };

function createMockSceneManager() {
  return {
    tree: { add: mock.fn(), remove: mock.fn() },
    scheduleStart: mock.fn(),
    cancelStart: mock.fn(),
    getSource: mock.fn(() => kScene),
    awake: mock.fn(),
    beginFrame: mock.fn(),
    update: mock.fn(),
    fixedUpdate: mock.fn(),
    endFrame: mock.fn(),
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
    sample: mock.fn(),
    publish: mock.fn(),
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
    exposeGame: mock.fn()
  };
}

describe("Systems.World", () => {
  let world: World;
  let sceneManager: ReturnType<typeof createMockSceneManager>;
  let renderer: ReturnType<typeof createMockRenderer>;
  let input: ReturnType<typeof createMockInput>;
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

    // @ts-expect-error
    world = new World(renderer, {
      sceneManager,
      input,
      audio: createMockAudio(),
      assetCoordinator: {},
      globalsAdapter: createMockGlobalsAdapter()
    });
  });

  describe("time", () => {
    test("should split game and wall-clock time in seconds", () => {
      scheduler.timeScale = 0.5;
      world.start();
      tick();

      tick(40);

      assert.strictEqual(world.time.delta, 0.02);
      assert.strictEqual(world.time.unscaledDelta, 0.04);
      assert.strictEqual(world.time.elapsed, 0.02);
      assert.strictEqual(world.time.unscaledElapsed, 0.04);
    });

    test("should keep wall-clock time flowing at a zero time scale", () => {
      scheduler.timeScale = 0;
      world.start();
      tick();

      tick(20);
      tick(20);

      assert.strictEqual(world.time.delta, 0);
      assert.strictEqual(world.time.elapsed, 0);
      assert.strictEqual(world.time.unscaledDelta, 0.02);
      assert.strictEqual(world.time.unscaledElapsed, 0.04);
    });

    test("should clamp wall-clock time like game time", () => {
      world.start();
      tick();

      tick(10_000);

      assert.strictEqual(world.time.unscaledDelta, 0.25);
    });

    test("should carry frames skipped by the render cap into the next delta", () => {
      scheduler.maxFps = 30;
      world.start();
      tick();

      tick(20);
      tick(20);

      assert.strictEqual(world.time.delta, 0.04);
      assert.strictEqual(world.time.unscaledDelta, 0.04);
      assert.strictEqual(world.time.elapsed, 0.04);
      assert.strictEqual(world.time.unscaledElapsed, 0.04);
    });

    test("should expose the delta read by update()", () => {
      const deltas: number[] = [];
      sceneManager.update.mock.mockImplementation(() => {
        deltas.push(world.time.delta);
      });
      world.start();
      tick();

      tick(20);

      assert.deepStrictEqual(deltas, [0, 0.02]);
    });

    test("should advance fixedElapsed once per completed step", () => {
      const seen: number[] = [];
      sceneManager.fixedUpdate.mock.mockImplementation(() => {
        seen.push(world.time.fixedElapsed);
      });
      world.start();
      tick();

      tick(3 * kFixedDelta60);

      assert.deepStrictEqual(seen, [
        0,
        kFixedDelta60 / 1000,
        2 * kFixedDelta60 / 1000
      ]);
      assert.strictEqual(world.time.fixedElapsed, 3 * kFixedDelta60 / 1000);
    });

    test("should not advance before start()", () => {
      tick(20);

      assert.strictEqual(world.time.unscaledElapsed, 0);
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
      tick(80);

      assert.strictEqual(sceneManager.fixedUpdate.mock.callCount(), 1);
    });

    test("should not advance a scheduler of its own", () => {
      world.start();
      const schedule = scheduler.advance(0);
      world.tick(schedule);
      world.tick(schedule);

      assert.strictEqual(sceneManager.beginFrame.mock.callCount(), 2);
      assert.strictEqual(scheduler.frameCount, 1);
    });
  });
});
