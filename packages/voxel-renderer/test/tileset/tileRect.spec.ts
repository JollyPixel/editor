// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  tileRectOf,
  tileRefFromRect
} from "../../src/tileset/index.ts";

describe("tileRectOf", () => {
  it("covers one tile by default", () => {
    assert.deepEqual(tileRectOf({ col: 2, row: 1 }, 16), {
      x: 32,
      y: 16,
      width: 16,
      height: 16
    });
  });

  it("anchors a custom size at the tile corner and applies bounds", () => {
    const rect = tileRectOf(
      { col: 1, row: 1, size: 32 },
      16,
      { u0: 0.5, v0: 0, u1: 1, v1: 0.5 }
    );

    assert.deepEqual(rect, {
      x: 32,
      y: 32,
      width: 16,
      height: 16
    });
  });
});

describe("tileRefFromRect", () => {
  it("inverts tileRectOf", () => {
    const bounds = { u0: 0.25, v0: 0, u1: 1, v1: 0.75 };
    const template = { tilesetId: "a", col: 0, row: 0, size: 32 };
    const rect = tileRectOf({ ...template, col: 3, row: 2 }, 16, bounds);

    assert.deepEqual(tileRefFromRect(rect, template, 16, bounds), {
      ...template,
      col: 3,
      row: 2
    });
  });
});
