// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import { FrameScheduler } from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  World,
  type WorldOptions
} from "../../../src/systems/World.ts";
import { HeadlessSceneGraph } from "../../../src/systems/scene/HeadlessSceneGraph.ts";

function createMockRenderer() {
  return {
    canvas: { addEventListener: mock.fn(), removeEventListener: mock.fn() },
    draw: mock.fn(),
    clear: mock.fn(),
    observeResize: mock.fn(),
    unobserveResize: mock.fn(),
    source: null,
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

function skip() {
  return undefined;
}

function spyFrame(
  world: World
) {
  const { sceneManager } = world;

  return {
    awake: mock.method(sceneManager, "awake", skip),
    beginFrame: mock.method(sceneManager, "beginFrame", skip),
    update: mock.method(sceneManager, "update", skip),
    fixedUpdate: mock.method(sceneManager, "fixedUpdate", skip),
    endFrame: mock.method(sceneManager, "endFrame", skip)
  };
}

export function createWorldHarness(
  options: Pick<WorldOptions, "debug" | "logger"> = {}
) {
  const renderer = createMockRenderer();
  const input = createMockInput();
  const scheduler = new FrameScheduler();
  let now = 0;

  const world: World = new World(renderer as any, {
    ...options,
    graph: new HeadlessSceneGraph(),
    input: input as any,
    audio: {
      volume: 1
    },
    assetCoordinator: {} as any
  });

  return {
    world,
    sceneManager: spyFrame(world),
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
