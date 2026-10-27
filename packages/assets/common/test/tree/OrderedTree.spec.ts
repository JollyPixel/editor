// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { InvalidEntryError } from "#src/tree/errors/InvalidEntryError.ts";
import {
  OrderedTree,
  type OrderedTreeEntry
} from "#src/tree/OrderedTree.ts";

interface Entry extends OrderedTreeEntry {
  folder: boolean;
}

function entry(
  id: string,
  parentId: string | null = null,
  folder = true
): Entry {
  return {
    id,
    parentId,
    folder
  };
}

function createTree(
  entries: Entry[] = []
): OrderedTree<Entry> {
  const tree = new OrderedTree<Entry>({
    entry: "node",
    canContain: (parent) => parent.folder
  });
  tree.load(entries);

  return tree;
}

function ids(
  tree: OrderedTree<Entry>
): string[] {
  return [...tree.scan()].map(({ id }) => id);
}

describe("OrderedTree", () => {
  test("lists entries depth first, siblings in their slot order", () => {
    const tree = createTree([
      entry("a"),
      entry("b"),
      entry("a2", "a"),
      entry("a1", "a")
    ]);
    tree.add(entry("c"), "b");
    tree.move("a1", "a", "a2");

    assert.deepEqual(ids(tree), ["a", "a1", "a2", "c", "b"]);
    assert.equal(tree.findNextSibling("c"), "b");
    assert.deepEqual(tree.subtreeFrom("a").map(({ id }) => id), ["a", "a1", "a2"]);
  });

  test("lifts children into the slot of their parent, in order", () => {
    const tree = createTree([
      entry("a"),
      entry("f"),
      entry("x", "f"),
      entry("y", "f"),
      entry("b")
    ]);
    tree.liftChildren("f");

    assert.deepEqual(ids(tree), ["a", "x", "y", "f", "b"]);
  });

  test("removes a whole subtree", () => {
    const tree = createTree([
      entry("a"),
      entry("b", "a"),
      entry("c", "b"),
      entry("d")
    ]);

    assert.deepEqual(tree.remove("a").map(({ id }) => id), ["a", "b", "c"]);
    assert.deepEqual(ids(tree), ["d"]);
  });

  test("an update keeps the entry in its slot", () => {
    const tree = createTree([
      entry("a"),
      entry("b", "a"),
      entry("c")
    ]);
    tree.update("b", (current) => {
      return {
        ...current,
        id: "z",
        parentId: "c",
        folder: false
      };
    });

    assert.deepEqual(ids(tree), ["a", "b", "c"]);
    assert.deepEqual(tree.get("b"), entry("b", "a", false));
  });

  test("refuses to move an entry into itself or a non container", () => {
    const tree = createTree([
      entry("a"),
      entry("b", "a"),
      entry("leaf", null, false)
    ]);

    assert.equal(tree.canMove("a", "b", undefined), false);
    assert.equal(tree.canMove("b", "leaf", undefined), false);
    assert.equal(tree.canMove("b", null, "a"), true);
  });

  for (const [title, entries] of [
    ["an entry listed twice", [entry("a"), entry("a")]],
    ["a missing parent", [entry("a", "ghost")]],
    ["a cycle", [entry("a", "b"), entry("b", "a")]],
    ["a parent that cannot contain", [entry("leaf", null, false), entry("a", "leaf")]]
  ] as const) {
    test(`refuses to load ${title} and keeps its entries`, () => {
      const tree = createTree([entry("kept")]);

      assert.throws(() => tree.load(entries), InvalidEntryError);
      assert.deepEqual(ids(tree), ["kept"]);
    });
  }
});
