// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Actor,
  Behavior
} from "../src/index.ts";
import { SceneManager } from "../src/systems/scene/SceneManager.ts";

class BehaviorOne extends Behavior {
  starts = 0;

  start() {
    this.starts++;
  }
}
class BehaviorTwo extends Behavior {}

function createActor() {
  const sceneManager = new SceneManager();
  const actor = new Actor(
    { sceneManager } as any,
    { name: "owner" }
  );

  return { actor, sceneManager };
}

describe("Behavior", () => {
  test("should register on its actor and start on the next frame", () => {
    const { actor, sceneManager } = createActor();

    const behavior = new BehaviorOne(actor);

    assert.deepEqual([...actor.components], [behavior]);
    assert.strictEqual(behavior.starts, 0);

    sceneManager.beginFrame();
    sceneManager.beginFrame();
    assert.strictEqual(behavior.starts, 1);
  });

  test("should find behaviors on the actor by class", () => {
    const { actor } = createActor();

    const first = new BehaviorOne(actor);
    const second = new BehaviorOne(actor);
    const other = new BehaviorTwo(actor);

    assert.deepEqual([...actor.getComponents(BehaviorOne)], [first, second]);
    assert.deepEqual([...actor.getComponents(BehaviorTwo)], [other]);
  });

  test("should leave the other behaviors on the actor when one is destroyed", () => {
    const { actor } = createActor();

    const behavior = new BehaviorOne(actor);
    const sameType = new BehaviorOne(actor);
    const otherType = new BehaviorTwo(actor);

    behavior.destroy();
    behavior.destroy();

    assert.deepEqual([...actor.components], [sameType, otherType]);
  });

  test("should still tear down a behavior already marked for destruction", () => {
    const { actor } = createActor();

    const behavior = new BehaviorOne(actor);
    behavior.markDestructionPending();
    behavior.destroy();

    assert.deepEqual([...actor.components], []);
  });
});
