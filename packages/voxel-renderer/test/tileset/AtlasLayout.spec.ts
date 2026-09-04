// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AtlasLayout } from "../../src/tileset/AtlasLayout.ts";
import { approxEqual } from "../helpers/math.ts";

// CONSTANTS
const kPadded = new AtlasLayout({
  cols: 4,
  rows: 4,
  tileSize: 16,
  padding: 2
});

function assertClose(
  actual: number,
  expected: number
): void {
  assert.ok(
    approxEqual(actual, expected),
    `expected ${actual} to be close to ${expected}`
  );
}

describe("AtlasLayout.defaultPadding", () => {
  it("is half the tile size in the usual range", () => {
    assert.equal(AtlasLayout.defaultPadding(8), 4);
    assert.equal(AtlasLayout.defaultPadding(16), 8);
  });

  it("never drops below 2 texels", () => {
    assert.equal(AtlasLayout.defaultPadding(1), 2);
    assert.equal(AtlasLayout.defaultPadding(4), 2);
  });

  it("caps the gutter so large atlases stay affordable", () => {
    assert.equal(AtlasLayout.defaultPadding(32), 8);
    assert.equal(AtlasLayout.defaultPadding(128), 8);
  });
});

describe("AtlasLayout", () => {
  it("leaves an atlas unpadded so any sub-tile rect stays addressable", () => {
    const layout = new AtlasLayout({ cols: 4, rows: 4, tileSize: 16 });

    assert.equal(layout.padding, 0);
    assert.equal(layout.cellSize, 16);
    assert.equal(layout.isPadded, false);
  });

  it("keeps an explicit padding, including zero", () => {
    const layout = new AtlasLayout({
      cols: 4,
      rows: 4,
      tileSize: 16,
      padding: 0
    });

    assert.equal(layout.padding, 0);
  });

  it("adds the gutter on both sides of a tile", () => {
    assert.equal(kPadded.cellSize, 20);
  });

  it("is the tile size when padding is disabled", () => {
    assert.equal(kPadded.withoutPadding().cellSize, 16);
  });

  it("sizes the padded canvas from the cell grid", () => {
    assert.equal(kPadded.paddedWidth, 80);
    assert.equal(kPadded.paddedHeight, 80);
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(kPadded));
  });
});

describe("AtlasLayout#isPadded", () => {
  it("is true for a positive gutter over a non-empty grid", () => {
    assert.equal(kPadded.isPadded, true);
  });

  it("is false without a gutter", () => {
    assert.equal(kPadded.withoutPadding().isPadded, false);
    assert.equal(
      new AtlasLayout({ ...kPadded, padding: -1 }).isPadded,
      false
    );
  });

  it("is false for a degenerate grid", () => {
    assert.equal(new AtlasLayout({ ...kPadded, cols: 0 }).isPadded, false);
    assert.equal(new AtlasLayout({ ...kPadded, rows: 0 }).isPadded, false);
    assert.equal(new AtlasLayout({ ...kPadded, tileSize: 0 }).isPadded, false);
  });
});

describe("AtlasLayout#withoutPadding", () => {
  it("drops the gutter", () => {
    assert.equal(kPadded.withoutPadding().padding, 0);
  });

  it("keeps the grid", () => {
    const bare = kPadded.withoutPadding();

    assert.equal(bare.cols, kPadded.cols);
    assert.equal(bare.rows, kPadded.rows);
    assert.equal(bare.tileSize, kPadded.tileSize);
  });

  it("returns the same instance when there is no gutter to drop", () => {
    const bare = kPadded.withoutPadding();

    assert.equal(bare.withoutPadding(), bare);
  });
});

describe("AtlasLayout#sourceBounds", () => {
  it("covers the unpadded image, so the gutter does not widen it", () => {
    assert.deepEqual(
      kPadded.sourceBounds(),
      { x: 0, y: 0, width: 64, height: 64 }
    );
  });
});

describe("AtlasLayout#uvFor", () => {
  describe("unpadded atlas (tileSize=16, 4×4)", () => {
    const layout = kPadded.withoutPadding();

    it("tile (0, 0) sits half a texel inside the top-left tile", () => {
      const uv = layout.uvFor(0, 0);
      assertClose(uv.offsetU, 0.0078125);
      assertClose(uv.offsetV, 0.7578125);
      assertClose(uv.scaleU, 15 / 64);
      assertClose(uv.scaleV, 15 / 64);
    });

    it("advances one tile width per column", () => {
      assertClose(layout.uvFor(1, 0).offsetU, 0.2578125);
    });

    it("row 3 is the bottom row once Y-flipped", () => {
      assertClose(layout.uvFor(0, 3).offsetV, 0.0078125);
    });

    it("reads real source texels at a fractional index", () => {
      // A UV region dragged off the tile grid lands here; without a gutter
      // the window is a plain sub-rect of the source image.
      const image = 64;
      const uv = layout.uvFor(1.5, 0);

      assertClose(uv.offsetU, ((1.5 * 16) + 0.5) / image);
      assertClose(uv.scaleU, 15 / image);
      // The window spans texels 24 through 39, straddling tiles 1 and 2.
      assertClose((uv.offsetU + uv.scaleU) * image, 39.5);
    });
  });

  describe("padded atlas (tileSize=16, 4×4, padding=2)", () => {
    // cell = 20 → image is 80×80; each tile body starts 2 texels into its cell.
    const image = 80;

    it("tile (0, 0) starts past its gutter", () => {
      const uv = kPadded.uvFor(0, 0);
      assertClose(uv.offsetU, 2.5 / image);
      assertClose(uv.offsetV, (80 - 20 + 2 + 0.5) / image);
      assertClose(uv.scaleU, 15 / image);
      assertClose(uv.scaleV, 15 / image);
    });

    it("advances one cell per column", () => {
      assertClose(kPadded.uvFor(1, 0).offsetU, 22.5 / image);
      assertClose(kPadded.uvFor(3, 0).offsetU, 62.5 / image);
    });

    it("advances one cell per row, bottom-up", () => {
      assertClose(kPadded.uvFor(0, 3).offsetV, 2.5 / image);
    });

    it("keeps every tile body strictly inside its own gutter", () => {
      for (let row = 0; row < kPadded.rows; row++) {
        for (let col = 0; col < kPadded.cols; col++) {
          const uv = kPadded.uvFor(col, row);
          const uMin = uv.offsetU * image;
          const uMax = (uv.offsetU + uv.scaleU) * image;
          const vMin = uv.offsetV * image;
          const vMax = (uv.offsetV + uv.scaleV) * image;
          const flippedRow = kPadded.rows - 1 - row;

          assert.ok(uMin >= (col * 20) + kPadded.padding);
          assert.ok(uMax <= ((col + 1) * 20) - kPadded.padding);
          assert.ok(vMin >= (flippedRow * 20) + kPadded.padding);
          assert.ok(vMax <= ((flippedRow + 1) * 20) - kPadded.padding);
        }
      }
    });
  });

  it("leaves the full gutter between a tile body and the next cell", () => {
    const layout = new AtlasLayout({
      cols: 2,
      rows: 2,
      tileSize: 8,
      padding: 2
    });
    const image = 2 * layout.cellSize;
    const uv = layout.uvFor(0, 0);

    // Body spans texels 2.5 → 9.5; the next tile body only starts at 14.
    assertClose(uv.offsetU * image, 2.5);
    assertClose((uv.offsetU + uv.scaleU) * image, 9.5);
  });
});

describe("AtlasLayout#tileRangeWithin", () => {
  it("covers the single tile a small rect sits inside", () => {
    assert.deepEqual(
      kPadded.tileRangeWithin({ x: 4, y: 4, width: 2, height: 2 }),
      { colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 }
    );
  });

  it("stops at the tile before a rect that ends on a tile boundary", () => {
    assert.deepEqual(
      kPadded.tileRangeWithin({ x: 0, y: 0, width: 16, height: 16 }),
      { colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 }
    );
  });

  it("takes in the next tile once the rect crosses the boundary by one texel", () => {
    assert.deepEqual(
      kPadded.tileRangeWithin({ x: 0, y: 0, width: 17, height: 17 }),
      { colStart: 0, colEnd: 1, rowStart: 0, rowEnd: 1 }
    );
  });

  it("starts on the next tile for a rect beginning on a boundary", () => {
    assert.deepEqual(
      kPadded.tileRangeWithin({ x: 16, y: 32, width: 1, height: 1 }),
      { colStart: 1, colEnd: 1, rowStart: 2, rowEnd: 2 }
    );
  });

  it("clamps a rect running past the atlas edge", () => {
    assert.deepEqual(
      kPadded.tileRangeWithin({ x: 48, y: 48, width: 999, height: 999 }),
      { colStart: 3, colEnd: 3, rowStart: 3, rowEnd: 3 }
    );
  });

  it("clamps a rect starting before the atlas origin", () => {
    assert.deepEqual(
      kPadded.tileRangeWithin({ x: -40, y: -40, width: 48, height: 48 }),
      { colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 }
    );
  });

  it("returns null for a rect entirely off the atlas", () => {
    assert.equal(
      kPadded.tileRangeWithin({ x: 64, y: 0, width: 16, height: 16 }),
      null
    );
    assert.equal(
      kPadded.tileRangeWithin({ x: 0, y: -16, width: 16, height: 16 }),
      null
    );
  });

  it("returns null for an empty rect", () => {
    assert.equal(
      kPadded.tileRangeWithin({ x: 0, y: 0, width: 0, height: 4 }),
      null
    );
    assert.equal(
      kPadded.tileRangeWithin({ x: 0, y: 0, width: 4, height: 0 }),
      null
    );
  });

  it("returns null when padding is disabled or the layout is degenerate", () => {
    const bounds = { x: 0, y: 0, width: 4, height: 4 };

    assert.equal(kPadded.withoutPadding().tileRangeWithin(bounds), null);
    assert.equal(
      new AtlasLayout({ ...kPadded, cols: 0 }).tileRangeWithin(bounds),
      null
    );
    assert.equal(
      new AtlasLayout({ ...kPadded, rows: 0 }).tileRangeWithin(bounds),
      null
    );
    assert.equal(
      new AtlasLayout({ ...kPadded, tileSize: 0 }).tileRangeWithin(bounds),
      null
    );
  });
});
