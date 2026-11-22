// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Actor } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { fakeWorld } from "../helpers/world/fakeWorld.ts";
import { UINode } from "../../src/ui/UINode.ts";

function createWorld() {
  return fakeWorld({
    input: {
      screen: {
        bounds: { left: -1, right: 1, top: 1, bottom: -1 }
      }
    },
    renderer: {
      on: mock.fn(),
      off: mock.fn()
    }
  });
}

describe("UI.UINode", () => {
  test("should stop following resizes once destroyed", () => {
    const world = createWorld();
    const actor = new Actor(world as any, { name: "hud" });
    const node = actor.addComponentAndGet(UINode, {
      anchor: { x: "left" }
    });

    assert.strictEqual(world.renderer.on.mock.callCount(), 1);
    const [eventName, handler] = world.renderer.on.mock.calls[0].arguments;

    node.destroy();

    assert.strictEqual(world.renderer.off.mock.callCount(), 1);
    assert.deepEqual(world.renderer.off.mock.calls[0].arguments, [eventName, handler]);
  });
});
