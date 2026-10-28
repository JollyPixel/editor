// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";
import { Actor } from "../../../src/actor/index.ts";
import { UpdateProbe } from "../../helpers/actor/updateProbe.ts";

// CONSTANTS
const kDeltaTime = 16.67;

function createFrames() {
  const sceneManager = new SceneManager();
  const world = { sceneManager } as any;

  return {
    createProbe(
      name: string,
      parent: Actor | null = null
    ) {
      const actor = new Actor(world, { name, parent });

      return actor.addComponentAndGet(UpdateProbe);
    },
    frame() {
      sceneManager.beginFrame();
      sceneManager.fixedUpdate(kDeltaTime);
      sceneManager.update(kDeltaTime);
      sceneManager.endFrame();
    }
  };
}

describe("Systems.Scene.ActorRegistry active actors", () => {
  test("should pause an inactive actor and its descendants until reactivated", () => {
    const { createProbe, frame } = createFrames();
    const parent = createProbe("parent");
    const child = createProbe("child", parent.actor);
    const sibling = createProbe("sibling");

    parent.actor.active = false;
    frame();

    assert.deepEqual(
      [parent, child, sibling].map((probe) => [probe.updates, probe.fixedUpdates]),
      [[0, 0], [0, 0], [1, 1]]
    );
    assert.strictEqual(child.actor.active, true);
    assert.strictEqual(child.actor.activeInHierarchy, false);

    parent.actor.active = true;
    frame();

    assert.deepEqual([parent.updates, child.updates], [1, 1]);
  });

  test("should keep a descendant paused that was deactivated itself", () => {
    const { createProbe, frame } = createFrames();
    const parent = createProbe("parent");
    const child = createProbe("child", parent.actor);

    child.actor.active = false;
    parent.actor.active = false;
    parent.actor.active = true;
    frame();

    assert.deepEqual([parent.updates, child.updates], [1, 0]);
  });

  test("should pause an actor moved under an inactive parent and resume it once moved out", () => {
    const { createProbe, frame } = createFrames();
    const inactive = createProbe("inactive");
    const mover = createProbe("mover");
    inactive.actor.active = false;

    mover.actor.setParent(inactive.actor);
    frame();
    mover.actor.setParent(null);
    frame();

    assert.strictEqual(mover.updates, 1);
  });

  test("should not update a component added to an inactive actor", () => {
    const { createProbe, frame } = createFrames();
    const parent = createProbe("parent");
    parent.actor.active = false;

    const late = new Actor(parent.actor.world, { name: "late", parent: parent.actor })
      .addComponentAndGet(UpdateProbe);
    frame();

    assert.strictEqual(late.updates, 0);
  });
});
