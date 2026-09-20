// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveTilesetDefinition,
  TilesetAtlas,
  type TilesetTexture
} from "../../src/tileset/index.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import { approxEqual } from "../helpers/math.ts";

// CONSTANTS
const kDefinition = {
  id: "default",
  src: "tileset.png",
  tileSize: 32
};

describe("resolveTilesetDefinition", () => {
  it("floors partial tiles out of the grid", () => {
    const def = resolveTilesetDefinition(kDefinition, { width: 100, height: 33 });

    assert.equal(def.cols, 3);
    assert.equal(def.rows, 1);
  });
});

describe("TilesetAtlas", () => {
  it("derives the tile grid from the atlas dimensions", () => {
    const atlas = new TilesetAtlas(kDefinition, mockTexture(128, 64));

    assert.deepEqual(atlas.def, {
      ...kDefinition,
      cols: 4,
      rows: 2
    });
  });

  it("keeps explicit dimensions over the derived ones", () => {
    const atlas = new TilesetAtlas(
      {
        ...kDefinition,
        cols: 1,
        rows: 9
      },
      mockTexture(128, 64)
    );

    assert.equal(atlas.def.cols, 1);
    assert.equal(atlas.def.rows, 9);
  });

  it("applies the pixel-art texture settings", () => {
    const texture = mockTexture(64, 64);
    const atlas = new TilesetAtlas(kDefinition, texture);

    assert.equal(atlas.texture, texture);
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.colorSpace, "srgb");
  });
});

describe("TilesetAtlas.uvFor", () => {
  const atlas = new TilesetAtlas(
    { id: "terrain", src: "t.png", tileSize: 16, cols: 4, rows: 4 },
    mockTexture(64, 64)
  );

  it("insets the top-left tile by half a texel", () => {
    const uv = atlas.uvFor(0, 0);

    assert.ok(approxEqual(uv.offsetU, 0.0078125));
    assert.ok(approxEqual(uv.offsetV, 0.7578125));
    assert.ok(approxEqual(uv.scaleU, 15 / 64));
    assert.ok(approxEqual(uv.scaleV, 15 / 64));
  });

  it("anchors a smaller region at the tile's top-left corner", () => {
    const uv = atlas.uvFor(1, 0, 8);

    assert.ok(approxEqual(uv.offsetU, 16.5 / 64));
    assert.ok(approxEqual(uv.offsetV, 56.5 / 64));
    assert.ok(approxEqual(uv.scaleU, 7 / 64));
  });

  it("maps fractional coordinates onto the texel grid", () => {
    const uv = atlas.uvFor(1.5, 0.5, 16);

    assert.ok(approxEqual(uv.offsetU, 24.5 / 64));
    assert.ok(approxEqual(uv.offsetV, 40.5 / 64));
  });

  it("swaps a rotated spanned footprint", () => {
    const uv = atlas.uvFor(0, 0, 16, { u: 1, v: Math.SQRT2 }, 1);

    assert.ok(approxEqual(uv.offsetU, 0.5 / 64));
    assert.ok(approxEqual(uv.offsetV, 48.5 / 64));
    assert.ok(approxEqual(uv.scaleU, 22 / 64));
    assert.ok(approxEqual(uv.scaleV, 15 / 64));
  });

  it("extends a spanned region downward over whole texels", () => {
    const uv = atlas.uvFor(0, 0, 16, { u: 1, v: Math.SQRT2 });

    assert.ok(approxEqual(uv.offsetU, 0.5 / 64));
    assert.ok(approxEqual(uv.offsetV, 41.5 / 64));
    assert.ok(approxEqual(uv.scaleU, 15 / 64));
    assert.ok(approxEqual(uv.scaleV, 22 / 64));
  });
});

describe("TilesetAtlas.updateImage", () => {
  it("replaces the image and flags it for re-upload", () => {
    const texture = mockTexture(64, 64);
    const atlas = new TilesetAtlas<TilesetTexture>(kDefinition, texture);

    const next = { width: 64, height: 64 } as unknown as HTMLCanvasElement;
    atlas.updateImage(next);

    assert.equal(texture.image, next);
    assert.equal(texture.needsUpdate, true);
  });
});
