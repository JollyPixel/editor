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

    assert.deepEqual(index.dependenciesOf("map"), [ref("a"), ref("b")]);
    assert.deepEqual(index.dependentsOf("a"), ["map", "model"]);
    assert.deepEqual(index.dependentsOf("b"), ["map"]);
    assert.deepEqual(index.dependenciesOf("unknown"), []);
    assert.deepEqual(index.dependentsOf("unknown"), []);
  });

  test("set replaces the outgoing edges and reports a change", () => {
    const index = new DependencyIndex();

    assert.strictEqual(index.set("map", [ref("a")]), true);
    assert.strictEqual(index.set("map", [ref("a")]), false);
    assert.strictEqual(index.set("map", [ref("b")]), true);

    assert.deepEqual(index.dependentsOf("a"), []);
    assert.deepEqual(index.dependentsOf("b"), ["map"]);
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
    assert.deepEqual(index.dependenciesOf("a"), []);
    assert.deepEqual(index.dependentsOf("a"), ["map"]);
    assert.deepEqual(index.dependentsOf("b"), []);
  });

  test("closureOf walks transitive edges breadth first", () => {
    const index = new DependencyIndex();
    index.set("map", [ref("a"), ref("b")]);
    index.set("a", [ref("c")]);
    index.set("b", [ref("c"), ref("d")]);

    assert.deepEqual(
      index.closureOf("map").map(({ id }) => id),
      ["a", "b", "c", "d"]
    );
  });

  test("closureOf terminates on cycles and never lists the root", () => {
    const index = new DependencyIndex();
    index.set("a", [ref("b")]);
    index.set("b", [ref("c")]);
    index.set("c", [ref("a"), ref("b")]);

    assert.deepEqual(
      index.closureOf("a").map(({ id }) => id),
      ["b", "c"]
    );
  });

  test("returned edges are copies", () => {
    const index = new DependencyIndex();
    const input = [ref("a")];
    index.set("map", input);
    input[0].id = "mutated";

    assert.deepEqual(index.dependenciesOf("map"), [ref("a")]);
    assert.notStrictEqual(
      index.dependenciesOf("map")[0],
      index.dependenciesOf("map")[0]
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
