// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { resolveBlocksetDefinition, BlocksetAtlas } from "../../../src/view/atlases/index.ts";
import { type AtlasTexture } from "../../../src/document/blocksets/index.ts";
import { mockTexture, readableTexture } from "../../helpers/mockTexture.ts";
import { approxEqual } from "../../helpers/math.ts";

// CONSTANTS
const kDefinition = {
  id: "default",
  src: "blockset.png",
  tileSize: 32
};

describe("resolveBlocksetDefinition", () => {
  it("floors partial tiles out of the grid", () => {
    const def = resolveBlocksetDefinition(kDefinition, { width: 100, height: 33 });

    assert.equal(def.cols, 3);
    assert.equal(def.rows, 1);
  });
});

describe("BlocksetAtlas", () => {
  it("derives the tile grid from the atlas dimensions", () => {
    const atlas = new BlocksetAtlas(kDefinition, mockTexture(128, 64));

    assert.deepEqual(atlas.def, {
      ...kDefinition,
      cols: 4,
      rows: 2
    });
  });

  it("keeps explicit dimensions over the derived ones", () => {
    const atlas = new BlocksetAtlas(
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
    const atlas = new BlocksetAtlas(kDefinition, texture);

    assert.equal(atlas.texture, texture);
    assert.equal(texture.magFilter, THREE.NearestFilter);
    assert.equal(texture.minFilter, THREE.NearestFilter);
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.colorSpace, "srgb");
  });
});

describe("BlocksetAtlas.uvFor", () => {
  const atlas = new BlocksetAtlas(
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

describe("BlocksetAtlas.updateImage", () => {
  it("replaces the image and flags it for re-upload", () => {
    const texture = readableTexture(64, 64);
    const atlas = new BlocksetAtlas<AtlasTexture>(kDefinition, texture);
    const version = texture.version;

    const next = { width: 64, height: 64 } as unknown as HTMLCanvasElement;
    atlas.updateImage(next);

    assert.equal(texture.image, next);
    assert.ok(texture.version > version);
  });
});

describe("BlocksetAtlas normal texture", () => {
  it("samples the normal texture as linear nearest data without mipmaps", () => {
    const normal = readableTexture(64, 64);
    const atlas = new BlocksetAtlas(kDefinition, mockTexture(), normal);

    assert.equal(atlas.normal, normal);
    assert.equal(normal.colorSpace, THREE.NoColorSpace);
    assert.equal(normal.magFilter, THREE.NearestFilter);
    assert.equal(normal.minFilter, THREE.NearestFilter);
    assert.equal(normal.generateMipmaps, false);
  });

  it("has none by default", () => {
    assert.equal(new BlocksetAtlas(kDefinition, mockTexture()).normal, null);
  });

  it("replaces the normal image and flags it for re-upload", () => {
    const normal = readableTexture(64, 64);
    const atlas = new BlocksetAtlas(kDefinition, mockTexture(), normal);
    const version = normal.version;

    const next = { width: 64, height: 64 };
    atlas.updateNormal(next);

    assert.equal(normal.image, next);
    assert.ok(normal.version > version);
  });

  it("refuses a normal image update without a normal texture", () => {
    const atlas = new BlocksetAtlas(kDefinition, mockTexture());

    assert.throws(
      () => atlas.updateNormal({ width: 64, height: 64 }),
      /blockset "default" has no normal texture/
    );
  });
});
