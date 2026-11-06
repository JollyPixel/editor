// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import type { FrameSchedule } from "@jolly-pixel/loop";

// Import Internal Dependencies
import { PhysicsSystem } from "#src/engine/PhysicsSystem.ts";
import { FakePhysicsBackend } from "./fakePhysics.ts";

// CONSTANTS
const kFixedDelta = 1000 / 60;

export interface TickOptions {
  steps?: number;
  alpha?: number;
}

export function createEngineWorld() {
  const sceneManager = new Systems.SceneManager();
  const world = new Systems.World(
    {
      canvas: {},
      draw: () => undefined,
      clear: () => undefined,
      observeResize: () => undefined,
      unobserveResize: () => undefined,
      dispose: () => undefined
    } as unknown as Systems.Renderer,
    {
      sceneManager,
      input: {
        connect: () => undefined,
        disconnect: () => undefined,
        sample: () => undefined,
        publish: () => undefined,
        exited: false
      } as unknown as Systems.WorldOptions["input"],
      audio: {} as Systems.WorldOptions["audio"],
      assetCoordinator: {} as Systems.WorldOptions["assetCoordinator"],
      globalsAdapter: {
        exposeGame: () => undefined
      }
    }
  );
  world.connect().start();

  return world;
}

export function createPhysicsHarness() {
  const world = createEngineWorld();
  const backend = new FakePhysicsBackend();
  const system = PhysicsSystem.attach(world, backend);
  const [physics] = backend.worlds;

  return {
    world,
    backend,
    physics,
    system,
    tick(
      options: TickOptions = {}
    ): void {
      const { steps = 1, alpha = 0 } = options;
      world.tick(createSchedule(steps, alpha));
    }
  };
}

function createSchedule(
  steps: number,
  alpha: number
): FrameSchedule {
  return {
    rawDelta: kFixedDelta,
    unscaledDelta: kFixedDelta,
    frameDelta: kFixedDelta,
    renderDelta: kFixedDelta,
    unscaledRenderDelta: kFixedDelta,
    fixedDelta: kFixedDelta,
    steps,
    alpha,
    render: true,
    clamped: false,
    snapped: false,
    panicked: false,
    droppedMs: 0
  };
}
