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

  describe("logger", () => {
    test("should let explicit logger options override the debug defaults", () => {
      // @ts-expect-error
      const debugWorld = new World(createMockRenderer(), {
        sceneManager: createMockSceneManager(),
        input: createMockInput(),
        audio: createMockAudio(),
        assetCoordinator: {},
        globalsAdapter: createMockGlobalsAdapter(),
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

      assert.strictEqual(renderer.draw.mock.calls[0].arguments[0], kScene);
    });
  });
});
