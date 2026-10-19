// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  UVNet,
  type UVNetCellInput
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UvNetDraft } from "../../../src/uv/nets/UvNetDraft.ts";

function draft(
  rows: UVNetCellInput[][]
): UvNetDraft {
  return UvNetDraft.from(new UVNet(rows).rows!);
}

describe("UvNetDraft", () => {
  test("groups a slot dropped on an occupied cell", () => {
    const next = draft([["front", "back"], ["top"]]).placed("top", { row: 0, column: 0 });

    assert.deepStrictEqual(next.cells, [[["front", "top"], ["back"]]]);
  });

  test("grows the grid when a slot lands on an edge cell", () => {
    const start = draft([["front", "back"]]);

    assert.deepStrictEqual(start.placed("top", { row: -1, column: 1 }).cells, [
      [[], ["top"]],
      [["front"], ["back"]]
    ]);
    assert.deepStrictEqual(start.placed("left", { row: 0, column: -1 }).cells, [
      [["left"], ["front"], ["back"]]
    ]);
    assert.deepStrictEqual(start.placed("bottom", { row: 1, column: 2 }).cells, [
      [["front"], ["back"], []],
      [[], [], ["bottom"]]
    ]);
  });

  test("trims the rows and columns a move or a removal leaves empty", () => {
    const start = draft([[null, "top"], ["left", "front"], [null, "bottom"]]);

    assert.deepStrictEqual(start.moved("left", -1, 0).cells, [
      [["left"], ["top"]],
      [[], ["front"]],
      [[], ["bottom"]]
    ]);
    assert.deepStrictEqual(start.unplaced("left").unplaced("bottom").cells, [
      [["top"]],
      [["front"]]
    ]);
  });

  test("ignores moves and removals of a slot it does not hold", () => {
    const start = draft([["front"]]);

    assert.strictEqual(start.moved("top", 0, 1), start);
    assert.strictEqual(start.unplaced("top"), start);
  });
});
