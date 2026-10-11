// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  rescaleTileRef,
  resolveTileRef,
  rotateTileBounds,
  rotateTileUv,
  tileFootprint,
  resolveTileRect,
  tileRefFromRect
} from "../../../src/document/blocksets/index.ts";

describe("resolveTileRect", () => {
  it("covers one tile by default", () => {
    assert.deepEqual(resolveTileRect({ col: 2, row: 1 }, 16), {
      x: 32,
      y: 16,
      width: 16,
      height: 16
    });
  });

  it("grows a spanned tile downward from its corner", () => {
    assert.deepEqual(
      resolveTileRect({ col: 2, row: 1 }, 16, undefined, { u: 1, v: Math.SQRT2 }),
      {
        x: 32,
        y: 16,
        width: 16,
        height: 23
      }
    );
  });

  it("anchors a custom size at the tile corner and applies bounds", () => {
    const rect = resolveTileRect(
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
  it("inverts resolveTileRect", () => {
    const bounds = { u0: 0.25, v0: 0, u1: 1, v1: 0.75 };
    const template = { blocksetId: "a", col: 0, row: 0, size: 32 };
    const rect = resolveTileRect({ ...template, col: 3, row: 2 }, 16, bounds);

    assert.deepEqual(tileRefFromRect(rect, template, 16, bounds), {
      ...template,
      col: 3,
      row: 2
    });
  });

  it("inverts a spanned resolveTileRect", () => {
    const bounds = { u0: 0, v0: 0, u1: 1, v1: 0.5 };
    const span = { u: 1, v: Math.SQRT2 };
    const template = { blocksetId: "a", col: 0, row: 0 };
    const rect = resolveTileRect({ ...template, col: 3, row: 2 }, 16, bounds, span);

    assert.deepEqual(tileRefFromRect(rect, template, 16, bounds, span), {
      ...template,
      col: 3,
      row: 2
    });
  });
});

describe("tileFootprint", () => {
  it("covers one tile without span", () => {
    assert.deepEqual(tileFootprint(16), { width: 16, height: 16 });
  });

  it("rounds a slope footprint to whole texels", () => {
    const span = { u: 1, v: Math.SQRT2 };

    assert.deepEqual(tileFootprint(8, span), { width: 8, height: 11 });
    assert.deepEqual(tileFootprint(16, span), { width: 16, height: 23 });
    assert.deepEqual(tileFootprint(32, span), { width: 32, height: 45 });
    assert.deepEqual(tileFootprint(64, span), { width: 64, height: 91 });
  });

  it("never shrinks below one texel", () => {
    assert.deepEqual(tileFootprint(0.2), { width: 1, height: 1 });
  });
});

describe("resolveTileRef", () => {
  it("expands a tuple, taking the default blockset", () => {
    assert.deepEqual(resolveTileRef([2, 3], "atlas"), {
      col: 2,
      row: 3,
      blocksetId: "atlas"
    });
  });

  it("keeps an explicit blocksetId over the default one", () => {
    assert.deepEqual(resolveTileRef({ col: 1, row: 1, blocksetId: "decor" }, "atlas"), {
      col: 1,
      row: 1,
      blocksetId: "decor"
    });
  });

  it("leaves blocksetId out when neither side provides one", () => {
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
    blocksetId: "a",
    from: 16,
    to: 32
  };

  it("keeps the same texels on the new grid", () => {
    assert.deepEqual(rescaleTileRef({ blocksetId: "a", col: 2, row: 3 }, rescale), {
      blocksetId: "a",
      col: 1,
      row: 1.5,
      size: 16
    });
  });

  it("keeps an explicit size", () => {
    const ref = rescaleTileRef({ blocksetId: "a", col: 2, row: 0, size: 8 }, rescale);

    assert.equal(ref.size, 8);
  });

  it("returns references of other blocksets unchanged", () => {
    const ref = { blocksetId: "b", col: 1, row: 1 };

    assert.equal(rescaleTileRef(ref, rescale), ref);
  });
});

describe("tile rotation", () => {
  it("turns tile-local UVs clockwise in image space", () => {
    assert.deepEqual(rotateTileUv(0, 1, 1), [1, 1]);
    assert.deepEqual(rotateTileUv(1, 1, 1), [1, 0]);
    assert.deepEqual(rotateTileUv(0.25, 0.75, 2), [0.75, 0.25]);
    assert.deepEqual(rotateTileUv(0.25, 0.75, 3), [0.25, 0.25]);
  });

  it("swaps an odd-rotated footprint", () => {
    const span = { u: 1, v: Math.SQRT2 };

    assert.deepEqual(tileFootprint(16, span, 1), { width: 23, height: 16 });
    assert.deepEqual(tileFootprint(16, span, 2), { width: 16, height: 23 });
  });

  it("turns bounds inside the footprint and back after four turns", () => {
    const topHalf = { u0: 0, v0: 0.5, u1: 1, v1: 1 };

    assert.deepEqual(rotateTileBounds(topHalf, 1), { u0: 0.5, v0: 0, u1: 1, v1: 1 });
    let bounds = topHalf;
    for (let turn = 0; turn < 4; turn++) {
      bounds = rotateTileBounds(bounds, 1);
    }
    assert.deepEqual(bounds, topHalf);
  });

  it("places rotated bounds in the rotated footprint, and inverts it", () => {
    const bounds = { u0: 0, v0: 0.5, u1: 1, v1: 1 };
    const template = { blocksetId: "a", col: 0, row: 0, rotation: 1 as const };
    const rect = resolveTileRect({ ...template, col: 1, row: 1 }, 16, bounds);

    assert.deepEqual(rect, { x: 24, y: 16, width: 8, height: 16 });
    assert.deepEqual(tileRefFromRect(rect, template, 16, bounds), {
      ...template,
      col: 1,
      row: 1
    });
  });

  it("inverts a rotated spanned resolveTileRect", () => {
    const span = { u: 1, v: Math.SQRT2 };
    const template = { blocksetId: "a", col: 0, row: 0, rotation: 3 as const };
    const rect = resolveTileRect({ ...template, col: 2, row: 1 }, 16, undefined, span);

    assert.deepEqual(rect, { x: 32, y: 16, width: 23, height: 16 });
    assert.deepEqual(tileRefFromRect(rect, template, 16, undefined, span), {
      ...template,
      col: 2,
      row: 1
    });
  });
});
