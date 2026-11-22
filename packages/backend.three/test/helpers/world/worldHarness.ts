// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import { FrameScheduler } from "@jolly-pixel/loop";
import { Systems } from "@jolly-pixel/ecs";

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

export function createWorldHarness(
  options: Pick<Systems.WorldOptions, "debug" | "logger"> = {}
) {
  const renderer = createMockRenderer();
  const input = createMockInput();
  const scheduler = new FrameScheduler();
  let now = 0;

  const world: Systems.World = new Systems.World(renderer as any, {
    ...options,
    graph: new Systems.HeadlessSceneGraph(),
    input: input as any,
    audio: {
      listener: {},
      setVolume: mock.fn(),
      getVolume: mock.fn()
    } as any,
    assetCoordinator: {} as any
  });

  return {
    world,
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
