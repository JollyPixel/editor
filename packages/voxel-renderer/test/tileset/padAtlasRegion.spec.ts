// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  atlasTileRange,
  padAtlas,
  padAtlasRegion,
  type AtlasLayout
} from "../../src/tileset/atlasLayout.ts";

// CONSTANTS
const kLayout: AtlasLayout = { cols: 4, rows: 4, tileSize: 16, padding: 2 };

type DrawCall = [unknown, ...number[]];

/**
 * Records the drawImage sequence instead of rasterizing it. Two runs issuing
 * the same calls against the same source produce the same pixels, which is
 * what "byte-identical to a full padAtlas" reduces to here — voxel-renderer's
 * suite has no DOM and no 2D context.
 */
class RecordingContext {
  readonly calls: DrawCall[] = [];
  imageSmoothingEnabled = true;

  drawImage(
    image: unknown,
    ...args: number[]
  ): void {
    this.calls.push([image, ...args]);
  }
}

class RecordingCanvas {
  width = 0;
  height = 0;
  readonly context = new RecordingContext();

  getContext(
    type: string
  ): RecordingContext | null {
    return type === "2d" ? this.context : null;
  }
}

const kCreatedCanvases: RecordingCanvas[] = [];
let previousDocument: unknown;

before(() => {
  previousDocument = (globalThis as Record<string, unknown>).document;
  (globalThis as Record<string, unknown>).document = {
    createElement(
      tagName: string
    ) {
      assert.equal(tagName, "canvas");
      const canvas = new RecordingCanvas();
      kCreatedCanvases.push(canvas);

      return canvas;
    }
  };
});

after(() => {
  (globalThis as Record<string, unknown>).document = previousDocument;
});

function fullPadCalls(
  image: unknown,
  layout: AtlasLayout
): DrawCall[] {
  const canvas = padAtlas(
    image as CanvasImageSource,
    layout
  ) as unknown as RecordingCanvas | null;
  assert.ok(canvas !== null, "padAtlas should have produced a canvas");

  return canvas.context.calls;
}

function regionPadCalls(
  image: unknown,
  layout: AtlasLayout,
  bounds: { x: number; y: number; width: number; height: number; }
): DrawCall[] {
  const canvas = new RecordingCanvas();
  padAtlasRegion(
    canvas as unknown as HTMLCanvasElement,
    image as CanvasImageSource,
    layout,
    bounds
  );

  return canvas.context.calls;
}

describe("atlasTileRange", () => {
  it("covers the single tile a small rect sits inside", () => {
    assert.deepEqual(
      atlasTileRange(kLayout, { x: 4, y: 4, width: 2, height: 2 }),
      { colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 }
    );
  });

  it("stops at the tile before a rect that ends on a tile boundary", () => {
    assert.deepEqual(
      atlasTileRange(kLayout, { x: 0, y: 0, width: 16, height: 16 }),
      { colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 }
    );
  });

  it("takes in the next tile once the rect crosses the boundary by one texel", () => {
    assert.deepEqual(
      atlasTileRange(kLayout, { x: 0, y: 0, width: 17, height: 17 }),
      { colStart: 0, colEnd: 1, rowStart: 0, rowEnd: 1 }
    );
  });

  it("starts on the next tile for a rect beginning on a boundary", () => {
    assert.deepEqual(
      atlasTileRange(kLayout, { x: 16, y: 32, width: 1, height: 1 }),
      { colStart: 1, colEnd: 1, rowStart: 2, rowEnd: 2 }
    );
  });

  it("clamps a rect running past the atlas edge", () => {
    assert.deepEqual(
      atlasTileRange(kLayout, { x: 48, y: 48, width: 999, height: 999 }),
      { colStart: 3, colEnd: 3, rowStart: 3, rowEnd: 3 }
    );
  });

  it("clamps a rect starting before the atlas origin", () => {
    assert.deepEqual(
      atlasTileRange(kLayout, { x: -40, y: -40, width: 48, height: 48 }),
      { colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 }
    );
  });

  it("returns null for a rect entirely off the atlas", () => {
    assert.equal(
      atlasTileRange(kLayout, { x: 64, y: 0, width: 16, height: 16 }),
      null
    );
    assert.equal(
      atlasTileRange(kLayout, { x: 0, y: -16, width: 16, height: 16 }),
      null
    );
  });

  it("returns null for an empty rect", () => {
    assert.equal(
      atlasTileRange(kLayout, { x: 0, y: 0, width: 0, height: 4 }),
      null
    );
    assert.equal(
      atlasTileRange(kLayout, { x: 0, y: 0, width: 4, height: 0 }),
      null
    );
  });

  it("returns null when padding is disabled or the layout is degenerate", () => {
    const bounds = { x: 0, y: 0, width: 4, height: 4 };

    assert.equal(atlasTileRange({ ...kLayout, padding: 0 }, bounds), null);
    assert.equal(atlasTileRange({ ...kLayout, cols: 0 }, bounds), null);
    assert.equal(atlasTileRange({ ...kLayout, rows: 0 }, bounds), null);
    assert.equal(atlasTileRange({ ...kLayout, tileSize: 0 }, bounds), null);
  });
});

describe("padAtlasRegion", () => {
  const image = {} as CanvasImageSource;

  it("reproduces padAtlas exactly when the bounds cover the whole atlas", () => {
    const expected = fullPadCalls(image, kLayout);
    const actual = regionPadCalls(image, kLayout, {
      x: 0,
      y: 0,
      width: kLayout.cols * kLayout.tileSize,
      height: kLayout.rows * kLayout.tileSize
    });

    assert.deepEqual(actual, expected);
  });

  it("redraws only the tiles the bounds touch", () => {
    const calls = regionPadCalls(image, kLayout, {
      x: 20,
      y: 4,
      width: 4,
      height: 4
    });

    // Nine slices for tile (1, 0) and nothing else.
    assert.equal(calls.length, 9);
    const [, sx, sy] = calls[0];
    assert.equal(sx, 16);
    assert.equal(sy, 0);
  });

  it("scales with the touched area, not the atlas", () => {
    const oneTile = regionPadCalls(image, kLayout, {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });
    const fourTiles = regionPadCalls(image, kLayout, {
      x: 14,
      y: 14,
      width: 4,
      height: 4
    });

    assert.equal(oneTile.length, 9);
    assert.equal(fourTiles.length, 36);
  });

  it("disables smoothing so gutters stay exact texel copies", () => {
    const canvas = new RecordingCanvas();
    padAtlasRegion(
      canvas as unknown as HTMLCanvasElement,
      image,
      kLayout,
      { x: 0, y: 0, width: 4, height: 4 }
    );

    assert.equal(canvas.context.imageSmoothingEnabled, false);
  });

  it("draws nothing when the bounds miss the atlas", () => {
    const calls = regionPadCalls(image, kLayout, {
      x: 999,
      y: 999,
      width: 4,
      height: 4
    });

    assert.deepEqual(calls, []);
  });

  it("draws nothing when padding is disabled", () => {
    const calls = regionPadCalls(
      image,
      { ...kLayout, padding: 0 },
      { x: 0, y: 0, width: 4, height: 4 }
    );

    assert.deepEqual(calls, []);
  });
});
