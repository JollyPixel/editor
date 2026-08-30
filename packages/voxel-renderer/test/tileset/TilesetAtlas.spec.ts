// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TilesetAtlas } from "../../src/tileset/TilesetAtlas.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import { approxEqual } from "../helpers/math.ts";

// CONSTANTS
const kDefinition = {
  id: "default",
  src: "tileset.png",
  tileSize: 32
};

describe("TilesetAtlas — resolved definition", () => {
  it("derives the tile grid from the atlas dimensions", () => {
    const atlas = new TilesetAtlas(kDefinition, mockTexture(128, 64));

    assert.deepEqual(atlas.def, {
      ...kDefinition,
      cols: 4,
      rows: 2
    });
  });

  it("floors partial tiles out of the grid", () => {
    const atlas = new TilesetAtlas(kDefinition, mockTexture(100, 33));

    assert.equal(atlas.def.cols, 3);
    assert.equal(atlas.def.rows, 1);
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
});

describe("TilesetAtlas — padding", () => {
  // node:test has no DOM, so padAtlas() cannot rasterize: this is the
  // unpadded fallback contract.
  it("falls back to the source texture when the environment cannot rasterize", () => {
    const texture = mockTexture(64, 64);
    const atlas = new TilesetAtlas(
      { id: "terrain", src: "t.png", tileSize: 16 },
      texture,
      4
    );

    assert.equal(atlas.texture, texture);
    assert.equal(atlas.sourceTexture, texture);
    assert.equal(atlas.layout.padding, 0);
  });

  it("applies the pixel-art texture settings to the render texture", () => {
    const texture = mockTexture(64, 64);
    const atlas = new TilesetAtlas(
      { id: "terrain", src: "t.png", tileSize: 16 },
      texture
    );

    assert.equal(atlas.texture.generateMipmaps, false);
    assert.equal(atlas.texture.colorSpace, "srgb");
  });
});

describe("TilesetAtlas.uvFor", () => {
  it("collapses to the raw atlas layout when padding is not applied", () => {
    const atlas = new TilesetAtlas(
      { id: "terrain", src: "t.png", tileSize: 16, cols: 4, rows: 4 },
      mockTexture(64, 64),
      4
    );

    const uv = atlas.uvFor(0, 0);
    assert.ok(approxEqual(uv.offsetU, 0.0078125));
    assert.ok(approxEqual(uv.scaleU, 15 / 64));
  });
});

describe("TilesetAtlas.updateSource", () => {
  it("replaces the source image and flags it for re-upload", () => {
    const texture = mockTexture(64, 64);
    const atlas = new TilesetAtlas(
      { id: "terrain", src: "t.png", tileSize: 16, cols: 4, rows: 4 },
      texture
    );

    const next = { width: 64, height: 64 } as unknown as HTMLCanvasElement;
    atlas.updateSource(next);

    assert.equal(atlas.sourceTexture.image, next);
    assert.equal(texture.needsUpdate, true);
  });
});
