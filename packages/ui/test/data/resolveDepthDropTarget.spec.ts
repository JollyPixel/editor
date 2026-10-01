// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveDepthDropTarget } from "../../src/data/tree/model.ts";
import { reparentTree } from "../fixtures/tree.ts";

describe("Data.resolveDepthDropTarget", () => {
  test("promotes a dragged node to root when hovering the root's own band, below", () => {
    const result = resolveDepthDropTarget({
      nodes: reparentTree(),
      movedIds: ["a2"],
      rowId: "a2",
      clientX: 0,
      containerLeft: 0,
      indentUnit: 16,
      where: "below"
    });

    assert.deepEqual(result, { targetId: "a", where: "below" });
  });

  test("promotes a dragged node to root when hovering the root's own band, above", () => {
    const result = resolveDepthDropTarget({
      nodes: reparentTree(),
      movedIds: ["a1"],
      rowId: "a1",
      clientX: 0,
      containerLeft: 0,
      indentUnit: 16,
      where: "above"
    });

    assert.deepEqual(result, { targetId: "a", where: "above" });
  });

  test("resolves to nothing in the dragged node's own band, which is a no-op", () => {
    const result = resolveDepthDropTarget({
      nodes: reparentTree(),
      movedIds: ["a2"],
      rowId: "a2",
      clientX: 16,
      containerLeft: 0,
      indentUnit: 16,
      where: "below"
    });

    assert.equal(result, null);
  });

  test("clamps past the row's own depth to that same no-op band", () => {
    const result = resolveDepthDropTarget({
      nodes: reparentTree(),
      movedIds: ["a2"],
      rowId: "a2",
      clientX: 1000,
      containerLeft: 0,
      indentUnit: 16,
      where: "below"
    });

    assert.equal(result, null);
  });

  test("targets the edge row itself when it is not the node being dragged, below", () => {
    const result = resolveDepthDropTarget({
      nodes: reparentTree(),
      movedIds: ["a1"],
      rowId: "c",
      clientX: 500,
      containerLeft: 0,
      indentUnit: 16,
      where: "below"
    });

    assert.deepEqual(result, { targetId: "c", where: "below" });
  });

  test("targets the edge row itself when it is not the node being dragged, above", () => {
    const result = resolveDepthDropTarget({
      nodes: reparentTree(),
      movedIds: ["c"],
      rowId: "a1",
      clientX: 500,
      containerLeft: 0,
      indentUnit: 16,
      where: "above"
    });

    assert.deepEqual(result, { targetId: "a1", where: "above" });
  });

  test("rejects a structurally valid depth drop the domain veto refuses", () => {
    const result = resolveDepthDropTarget({
      nodes: reparentTree(),
      movedIds: ["a1"],
      rowId: "c",
      clientX: 500,
      containerLeft: 0,
      indentUnit: 16,
      where: "below",
      accept: () => false
    });

    assert.equal(result, null);
  });
});
