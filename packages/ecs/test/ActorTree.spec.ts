// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Actor } from "../src/index.ts";
import { createHeadlessWorld } from "./helpers/world/headlessWorld.ts";

function createTree() {
  const world = createHeadlessWorld();
  const { tree } = world.sceneManager;

  return {
    tree,
    createActor(
      name: string,
      parent: Actor | null = null
    ) {
      return world.createActor(name, { parent });
    }
  };
}

describe("ActorTree", () => {
  describe("findActor", () => {
    test("should find an actor by name at any depth", () => {
      const { tree, createActor } = createTree();
      const player = createActor("Player");
      const weapon = createActor("Weapon", player);
      createActor("Enemy");

      assert.strictEqual(tree.findActor("Player"), player);
      assert.strictEqual(tree.findActor("Weapon"), weapon);
      assert.strictEqual(tree.findActor("NonExistent"), null);
    });

    test("should ignore actors pending destruction", () => {
      const { tree, createActor } = createTree();
      createActor("Player").markDestructionPending();

      assert.strictEqual(tree.findActor("Player"), null);
    });
  });

  test("should iterate over its live root actors only", () => {
    const { tree, createActor } = createTree();
    const root = createActor("root");
    createActor("child", root);
    createActor("pending").markDestructionPending();

    assert.deepEqual([...tree], [root]);
  });

  test("should walk every actor depth-first with its parent", () => {
    const { tree, createActor } = createTree();
    const first = createActor("first");
    const child = createActor("child", first);
    const grandChild = createActor("grandChild", child);
    const sibling = createActor("sibling", first);
    const second = createActor("second");
    const other = createActor("other", second);

    assert.deepEqual(
      [...tree.walk()].map(({ actor, parent }) => [actor, parent]),
      [
        [first, undefined],
        [child, first],
        [grandChild, child],
        [sibling, first],
        [second, undefined],
        [other, second]
      ]
    );
  });

  test("should walk the descendants of an actor with their parent", () => {
    const { createActor } = createTree();
    const root = createActor("root");
    const child = createActor("child", root);
    const grandChild = createActor("grandChild", child);

    assert.deepEqual(
      [...root.walk()].map(({ actor, parent }) => [actor, parent]),
      [
        [child, root],
        [grandChild, child]
      ]
    );
    assert.deepEqual([...grandChild.walk()], []);
  });
});
