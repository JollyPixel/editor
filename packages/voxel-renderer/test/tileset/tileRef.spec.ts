// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  rescaleTileRef,
  resolveTileRef,
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

describe("resolveTileRef", () => {
  it("expands a tuple, taking the default tileset", () => {
    assert.deepEqual(resolveTileRef([2, 3], "atlas"), {
      col: 2,
      row: 3,
      tilesetId: "atlas"
    });
  });

  it("keeps an explicit tilesetId over the default one", () => {
    assert.deepEqual(resolveTileRef({ col: 1, row: 1, tilesetId: "decor" }, "atlas"), {
      col: 1,
      row: 1,
      tilesetId: "decor"
    });
  });

  it("leaves tilesetId out when neither side provides one", () => {
    assert.deepEqual(resolveTileRef({ col: 1, row: 1 }), {
      col: 1,
      row: 1
    });
  });

  it("copies the reference instead of mutating it", () => {
    const ref = { col: 1, row: 1 };
    const resolved = resolveTileRef(ref, "atlas");

    assert.notEqual(resolved, ref);
    assert.deepEqual(ref, { col: 1, row: 1 });
  });
});

describe("rescaleTileRef", () => {
  const rescale = {
    tilesetId: "a",
    from: 16,
    to: 32
  };

  it("keeps the same texels on the new grid", () => {
    assert.deepEqual(rescaleTileRef({ tilesetId: "a", col: 2, row: 3 }, rescale), {
      tilesetId: "a",
      col: 1,
      row: 1.5,
      size: 16
    });
  });

  it("keeps an explicit size", () => {
    const ref = rescaleTileRef({ tilesetId: "a", col: 2, row: 0, size: 8 }, rescale);

    assert.equal(ref.size, 8);
  });

  it("returns references of other tilesets unchanged", () => {
    const ref = { tilesetId: "b", col: 1, row: 1 };

    assert.equal(rescaleTileRef(ref, rescale), ref);
  });
});
