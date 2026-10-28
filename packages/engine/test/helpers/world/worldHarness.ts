// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import { FrameScheduler } from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  World,
  type WorldOptions
} from "../../../src/systems/World.ts";

// CONSTANTS
export const SCENE_SOURCE = { isScene: true };

function createMockSceneManager() {
  return {
    getSource: mock.fn(() => SCENE_SOURCE),
    awake: mock.fn(),
    beginFrame: mock.fn(),
    update: mock.fn(),
    fixedUpdate: mock.fn(),
    endFrame: mock.fn(),
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

export function createWorldHarness(
  options: Pick<WorldOptions, "debug" | "logger"> = {}
) {
  const sceneManager = createMockSceneManager();
  const renderer = createMockRenderer();
  const input = createMockInput();
  const scheduler = new FrameScheduler();
  let now = 0;

  const world: World = new World(renderer as any, {
    ...options,
    sceneManager: sceneManager as any,
    input: input as any,
    audio: {
      listener: {},
      setVolume: mock.fn(),
      getVolume: mock.fn()
    } as any,
    assetCoordinator: {} as any,
    globalsAdapter: {
      exposeGame: mock.fn()
    }
  });

  return {
    world,
    sceneManager,
    renderer,
    input,
    scheduler,
    tick(
      deltaMs = 0
    ): boolean {
      now += deltaMs;

      return world.tick(scheduler.advance(now));
    }
  };
}

export type WorldHarness = ReturnType<typeof createWorldHarness>;
