// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  matchRenames,
  type ObservedEntry,
  type ProjectedEntry
} from "#src/index.ts";

function projected(
  id: string,
  path: string,
  hash: string
): ProjectedEntry {
  return { id, path, kind: "binary", hash };
}

function observed(
  path: string,
  hash: string
): ObservedEntry {
  return { path, hash };
}

describe("matchRenames", () => {
  test("reports nothing when the states agree", () => {
    const result = matchRenames(
      [projected("1", "a.png", "h1")],
      [observed("a.png", "h1")]
    );

    assert.deepEqual(result, {
      renamed: [],
      updated: [],
      created: [],
      deleted: []
    });
  });

  test("a content change at a stable path is an update", () => {
    const result = matchRenames(
      [projected("1", "a.png", "h1")],
      [observed("a.png", "h2")]
    );

    assert.deepEqual(result.updated, [{
      id: "1",
      kind: "binary",
      path: "a.png",
      hash: "h2"
    }]);
    assert.deepEqual(result.renamed, []);
  });

  test("an unambiguous move is a rename", () => {
    const result = matchRenames(
      [projected("1", "a.png", "h1")],
      [observed("b.png", "h1")]
    );

    assert.deepEqual(result.renamed, [{
      id: "1",
      kind: "binary",
      from: "a.png",
      to: "b.png",
      hash: "h1"
    }]);
    assert.deepEqual(result.created, []);
    assert.deepEqual(result.deleted, []);
  });

  test("two identical files renamed at once collapse to create plus delete", () => {
    const result = matchRenames(
      [
        projected("1", "a.png", "h1"),
        projected("2", "b.png", "h1")
      ],
      [
        observed("c.png", "h1"),
        observed("d.png", "h1")
      ]
    );

    assert.deepEqual(result.renamed, []);
    assert.deepEqual(
      result.created.map((entry) => entry.path),
      ["c.png", "d.png"]
    );
    assert.deepEqual(
      result.deleted.map((entry) => entry.path),
      ["a.png", "b.png"]
    );
  });

  test("a copy is a create, not a rename", () => {
    const result = matchRenames(
      [projected("1", "a.png", "h1")],
      [
        observed("a.png", "h1"),
        observed("copy.png", "h1")
      ]
    );

    assert.deepEqual(result.renamed, []);
    assert.deepEqual(result.created, [{
      path: "copy.png",
      hash: "h1"
    }]);
    assert.deepEqual(result.deleted, []);
  });

  test("a rename plus an edit is a delete plus a create", () => {
    const result = matchRenames(
      [projected("1", "a.png", "h1")],
      [observed("b.png", "h2")]
    );

    assert.deepEqual(result.renamed, []);
    assert.deepEqual(result.created, [{ path: "b.png", hash: "h2" }]);
    assert.deepEqual(
      result.deleted,
      [{ id: "1", kind: "binary", path: "a.png" }]
    );
  });

  test("a disappeared path with no counterpart is a delete", () => {
    const result = matchRenames(
      [projected("1", "a.png", "h1")],
      []
    );

    assert.deepEqual(
      result.deleted,
      [{ id: "1", kind: "binary", path: "a.png" }]
    );
  });

  test("an appeared path with no counterpart is a create", () => {
    const result = matchRenames(
      [],
      [observed("a.png", "h1")]
    );

    assert.deepEqual(result.created, [{ path: "a.png", hash: "h1" }]);
  });

  test("one source matched by two targets stays ambiguous", () => {
    const result = matchRenames(
      [projected("1", "a.png", "h1")],
      [
        observed("b.png", "h1"),
        observed("c.png", "h1")
      ]
    );

    assert.deepEqual(result.renamed, []);
    assert.deepEqual(
      result.created.map((entry) => entry.path),
      ["b.png", "c.png"]
    );
    assert.deepEqual(
      result.deleted.map((entry) => entry.path),
      ["a.png"]
    );
  });

  test("resolves git-pull-shaped drift in a single pass", () => {
    const result = matchRenames(
      [
        projected("1", "a.png", "h1"),
        projected("2", "b.png", "h2"),
        projected("3", "gone.png", "h3"),
        projected("4", "moved.png", "h4")
      ],
      [
        observed("a.png", "h1-new"),
        observed("b.png", "h2-new"),
        observed("elsewhere/moved.png", "h4"),
        observed("added.png", "h5")
      ]
    );

    assert.deepEqual(
      result.updated.map((entry) => entry.path),
      ["a.png", "b.png"]
    );
    assert.deepEqual(
      result.renamed.map((entry) => `${entry.from}->${entry.to}`),
      ["moved.png->elsewhere/moved.png"]
    );
    assert.deepEqual(
      result.created.map((entry) => entry.path),
      ["added.png"]
    );
    assert.deepEqual(
      result.deleted.map((entry) => entry.path),
      ["gone.png"]
    );
  });

  test("preserves the kind carried by the previous state", () => {
    const result = matchRenames(
      [{ id: "1", path: "a.png", kind: "pixelart", hash: "h1" }],
      [observed("b.png", "h1")]
    );

    assert.strictEqual(result.renamed[0].kind, "pixelart");
  });
});
