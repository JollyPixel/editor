// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DependencyIndex } from "#src/catalog/client/index.ts";

function ref(
  id: string
): { id: string; kind: string; } {
  return {
    id,
    kind: "pixelart"
  };
}

describe("DependencyIndex", () => {
  test("indexes edges both ways", () => {
    const index = new DependencyIndex();
    index.set("map", [ref("a"), ref("b")]);
    index.set("model", [ref("a")]);

    assert.deepEqual(index.listDependencies("map"), [ref("a"), ref("b")]);
    assert.deepEqual(index.listDependents("a"), ["map", "model"]);
    assert.deepEqual(index.listDependents("b"), ["map"]);
    assert.deepEqual(index.listDependencies("unknown"), []);
    assert.deepEqual(index.listDependents("unknown"), []);
  });

  test("set replaces the outgoing edges and reports a change", () => {
    const index = new DependencyIndex();

    assert.strictEqual(index.set("map", [ref("a")]), true);
    assert.strictEqual(index.set("map", [ref("a")]), false);
    assert.strictEqual(index.set("map", [ref("b")]), true);

    assert.deepEqual(index.listDependents("a"), []);
    assert.deepEqual(index.listDependents("b"), ["map"]);
  });

  test("an empty edge list is still an entry", () => {
    const index = new DependencyIndex();

    assert.strictEqual(index.set("map", []), true);
    assert.strictEqual(index.has("map"), true);
    assert.strictEqual(index.set("map", []), false);
  });

  test("delete drops outgoing edges and keeps incoming ones", () => {
    const index = new DependencyIndex();
    index.set("map", [ref("a")]);
    index.set("a", [ref("b")]);

    assert.strictEqual(index.delete("a"), true);
    assert.strictEqual(index.delete("a"), false);
    assert.deepEqual(index.listDependencies("a"), []);
    assert.deepEqual(index.listDependents("a"), ["map"]);
    assert.deepEqual(index.listDependents("b"), []);
  });

  test("transitiveDependencies walks transitive edges breadth first", () => {
    const index = new DependencyIndex();
    index.set("map", [ref("a"), ref("b")]);
    index.set("a", [ref("c")]);
    index.set("b", [ref("c"), ref("d")]);

    assert.deepEqual(
      index.transitiveDependencies("map").map(({ id }) => id),
      ["a", "b", "c", "d"]
    );
  });

  test("transitiveDependencies terminates on cycles and never lists the root", () => {
    const index = new DependencyIndex();
    index.set("a", [ref("b")]);
    index.set("b", [ref("c")]);
    index.set("c", [ref("a"), ref("b")]);

    assert.deepEqual(
      index.transitiveDependencies("a").map(({ id }) => id),
      ["b", "c"]
    );
  });

  test("dependenciesFirst lists each asset once, after its dependencies", () => {
    const index = new DependencyIndex();
    index.set("map", [ref("a"), ref("b")]);
    index.set("a", [ref("c")]);
    index.set("b", [ref("c"), ref("map")]);

    assert.deepEqual(
      index.dependenciesFirst([ref("map"), ref("c"), ref("e")])
        .map(({ id }) => id),
      ["c", "a", "b", "map", "e"]
    );
  });

  test("returned edges are copies", () => {
    const index = new DependencyIndex();
    const input = [ref("a")];
    index.set("map", input);
    input[0].id = "mutated";

    assert.deepEqual(index.listDependencies("map"), [ref("a")]);
    assert.notStrictEqual(
      index.listDependencies("map")[0],
      index.listDependencies("map")[0]
    );
  });

  test("toJSON maps each indexed asset to its edges", () => {
    const index = new DependencyIndex();
    index.set("map", [ref("a")]);
    index.set("a", []);

    assert.deepEqual(index.toJSON(), {
      map: [ref("a")],
      a: []
    });

    index.clear();
    assert.deepEqual(index.toJSON(), {});
  });
});
