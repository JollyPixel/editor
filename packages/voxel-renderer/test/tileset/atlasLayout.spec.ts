// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  defaultPadding,
  padAtlas,
  paddedCellSize,
  tileUVRegion,
  type AtlasLayout
} from "../../src/tileset/atlasLayout.ts";

// CONSTANTS
const kEpsilon = 1e-10;

function assertClose(
  actual: number,
  expected: number
): void {
  assert.ok(
    Math.abs(actual - expected) < kEpsilon,
    `expected ${actual} to be close to ${expected}`
  );
}

describe("paddedCellSize", () => {
  it("adds the gutter on both sides of a tile", () => {
    assert.equal(paddedCellSize(16, 2), 20);
  });

  it("is the tile size when padding is disabled", () => {
    assert.equal(paddedCellSize(16, 0), 16);
  });
});

describe("defaultPadding", () => {
  it("is half the tile size in the usual range", () => {
    assert.equal(defaultPadding(8), 4);
    assert.equal(defaultPadding(16), 8);
  });

  it("never drops below 2 texels", () => {
    assert.equal(defaultPadding(1), 2);
    assert.equal(defaultPadding(4), 2);
  });

  it("caps the gutter so large atlases stay affordable", () => {
    assert.equal(defaultPadding(32), 8);
    assert.equal(defaultPadding(128), 8);
  });
});

describe("tileUVRegion", () => {
  describe("unpadded atlas (tileSize=16, 4×4)", () => {
    const layout: AtlasLayout = { cols: 4, rows: 4, tileSize: 16, padding: 0 };

    it("tile (0, 0) sits half a texel inside the top-left tile", () => {
      const uv = tileUVRegion(0, 0, layout);
      assertClose(uv.offsetU, 0.0078125);
      assertClose(uv.offsetV, 0.7578125);
      assertClose(uv.scaleU, 15 / 64);
      assertClose(uv.scaleV, 15 / 64);
    });

    it("advances one tile width per column", () => {
      assertClose(tileUVRegion(1, 0, layout).offsetU, 0.2578125);
    });

    it("row 3 is the bottom row once Y-flipped", () => {
      assertClose(tileUVRegion(0, 3, layout).offsetV, 0.0078125);
    });
  });

  describe("padded atlas (tileSize=16, 4×4, padding=2)", () => {
    const layout: AtlasLayout = { cols: 4, rows: 4, tileSize: 16, padding: 2 };
    // cell = 20 → image is 80×80; each tile body starts 2 texels into its cell.
    const image = 80;

    it("tile (0, 0) starts past its gutter", () => {
      const uv = tileUVRegion(0, 0, layout);
      assertClose(uv.offsetU, 2.5 / image);
      assertClose(uv.offsetV, (80 - 20 + 2 + 0.5) / image);
      assertClose(uv.scaleU, 15 / image);
      assertClose(uv.scaleV, 15 / image);
    });

    it("advances one cell per column", () => {
      assertClose(tileUVRegion(1, 0, layout).offsetU, 22.5 / image);
      assertClose(tileUVRegion(3, 0, layout).offsetU, 62.5 / image);
    });

    it("advances one cell per row, bottom-up", () => {
      assertClose(tileUVRegion(0, 3, layout).offsetV, 2.5 / image);
    });

    it("keeps every tile body strictly inside its own gutter", () => {
      for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.cols; col++) {
          const uv = tileUVRegion(col, row, layout);
          const uMin = uv.offsetU * image;
          const uMax = (uv.offsetU + uv.scaleU) * image;
          const vMin = uv.offsetV * image;
          const vMax = (uv.offsetV + uv.scaleV) * image;
          const flippedRow = layout.rows - 1 - row;

          assert.ok(uMin >= (col * 20) + layout.padding);
          assert.ok(uMax <= ((col + 1) * 20) - layout.padding);
          assert.ok(vMin >= (flippedRow * 20) + layout.padding);
          assert.ok(vMax <= ((flippedRow + 1) * 20) - layout.padding);
        }
      }
    });
  });

  it("leaves the full gutter between a tile body and the next cell", () => {
    const layout: AtlasLayout = { cols: 2, rows: 2, tileSize: 8, padding: 2 };
    const image = 2 * paddedCellSize(8, 2);
    const uv = tileUVRegion(0, 0, layout);

    // Body spans texels 2.5 → 9.5; the next tile body only starts at 14.
    assertClose(uv.offsetU * image, 2.5);
    assertClose((uv.offsetU + uv.scaleU) * image, 9.5);
  });
});

describe("padAtlas", () => {
  // Every case below bails out before touching the DOM, so these hold in the
  // plain node:test environment where `document` is undefined.
  const image = {} as CanvasImageSource;
  const layout: AtlasLayout = { cols: 4, rows: 4, tileSize: 16, padding: 2 };

  it("returns null when padding is disabled", () => {
    assert.equal(padAtlas(image, { ...layout, padding: 0 }), null);
  });

  it("returns null for a negative padding", () => {
    assert.equal(padAtlas(image, { ...layout, padding: -1 }), null);
  });

  it("returns null for a degenerate layout", () => {
    assert.equal(padAtlas(image, { ...layout, cols: 0 }), null);
    assert.equal(padAtlas(image, { ...layout, rows: 0 }), null);
    assert.equal(padAtlas(image, { ...layout, tileSize: 0 }), null);
  });

  it("returns null when the environment cannot rasterize", () => {
    assert.equal(typeof document, "undefined");
    assert.equal(padAtlas(image, layout), null);
  });
});
