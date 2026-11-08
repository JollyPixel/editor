// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { FrameScheduler } from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  Behavior,
  Systems
} from "../../src/core/index.ts";

// CONSTANTS
const kFixedDelta60 = 1000 / 60;

class Walker extends Behavior {
  update(): void {
    this.actor.transform.moveLocal({ x: 1, y: 0, z: 0 });
  }
}

function createHeadlessWorld() {
  const renderer = new Systems.HeadlessRenderer({} as HTMLCanvasElement);
  const world = new Systems.World(renderer, {
    sceneManager: new Systems.SceneManager(new Systems.HeadlessSceneGraph()),
    input: {
      connect: () => undefined,
      disconnect: () => undefined,
      sample: () => undefined,
      publish: () => undefined,
      exited: false
    } as unknown as Systems.WorldOptions["input"],
    assetCoordinator: {} as Systems.WorldOptions["assetCoordinator"],
    globalsAdapter: {
      exposeGame: () => undefined
    }
  });

  return { renderer, world };
}

describe("Systems.World on the headless backend", () => {
  test("runs behaviors, transforms and draws without a render scene", () => {
    const { renderer, world } = createHeadlessWorld();
    const parent = world.createActor("parent");
    parent.transform.setLocalPosition({ x: 10, y: 0, z: 0 });
    const walker = world.createActor("walker", { parent });
    walker.addComponent(Walker);
    let draws = 0;
    renderer.on("draw", () => draws++);

    world.connect().start();
    const scheduler = new FrameScheduler();
    world.tick(scheduler.advance(kFixedDelta60));
    world.tick(scheduler.advance(kFixedDelta60 * 2));

    assert.deepEqual(walker.transform.getGlobalPosition().toArray(), [12, 0, 0]);
    assert.strictEqual(draws, 2);
  });
});
