// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../src/index.ts";
import { createWorld } from "./helpers/actor/mockWorld.ts";

describe("Actor.reparent", () => {
  test("should keep the world position when reparenting", () => {
    const world = createWorld();
    const parent = new Actor(world as any, { name: "parent" });
    parent.transform.local.position = { x: 10, y: 0, z: 0 };
    const child = new Actor(world as any, { name: "child" });
    child.transform.local.position = { x: 1, y: 2, z: 3 };

    child.reparent(parent);

    assert.deepEqual(child.transform.global.position, { x: 1, y: 2, z: 3 });
    assert.deepEqual(child.transform.local.position, { x: -9, y: 2, z: 3 });
    assert.ok(parent.children.includes(child));
    assert.ok(!world.sceneManager.tree.children.includes(child));
  });

  test("should move an actor back to the scene root", () => {
    const world = createWorld();
    const parent = new Actor(world as any, { name: "parent" });
    parent.transform.local.position = { x: 10, y: 0, z: 0 };
    const child = new Actor(world as any, { name: "child", parent });

    child.reparent(null);

    assert.strictEqual(child.parent, null);
    assert.ok(world.sceneManager.tree.children.includes(child));
    assert.deepEqual(child.transform.global.position, { x: 10, y: 0, z: 0 });
  });
});
