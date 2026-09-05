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
  AtlasLayout,
  type AtlasRegion
} from "../../src/tileset/index.ts";
import {
  padAtlas,
  padAtlasRegion
} from "../../src/tileset/padAtlas.ts";

// CONSTANTS
const kLayout = new AtlasLayout({
  cols: 4,
  rows: 4,
  tileSize: 16,
  padding: 2
});

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

describe("padAtlas without a DOM", () => {
  // Every case below bails out before touching the DOM, so these hold in the
  // plain node:test environment where `document` is undefined.
  const image = {} as CanvasImageSource;

  it("returns null when padding is disabled", () => {
    assert.equal(padAtlas(image, kLayout.withoutPadding()), null);
  });

  it("returns null for a negative padding", () => {
    assert.equal(
      padAtlas(image, new AtlasLayout({ ...kLayout, padding: -1 })),
      null
    );
  });

  it("returns null for a degenerate layout", () => {
    assert.equal(
      padAtlas(image, new AtlasLayout({ ...kLayout, cols: 0 })),
      null
    );
    assert.equal(
      padAtlas(image, new AtlasLayout({ ...kLayout, rows: 0 })),
      null
    );
    assert.equal(
      padAtlas(image, new AtlasLayout({ ...kLayout, tileSize: 0 })),
      null
    );
  });

  it("returns null when the environment cannot rasterize", () => {
    assert.equal(typeof document, "undefined");
    assert.equal(padAtlas(image, kLayout), null);
  });
});

describe("padAtlas and padAtlasRegion", () => {
  const image = {} as CanvasImageSource;
  const createdCanvases: RecordingCanvas[] = [];
  let previousDocument: unknown;

  before(() => {
    previousDocument = (globalThis as Record<string, unknown>).document;
    (globalThis as Record<string, unknown>).document = {
      createElement(
        tagName: string
      ) {
        assert.equal(tagName, "canvas");
        const canvas = new RecordingCanvas();
        createdCanvases.push(canvas);

        return canvas;
      }
    };
  });

  after(() => {
    (globalThis as Record<string, unknown>).document = previousDocument;
  });

  function fullPadCalls(
    layout: AtlasLayout
  ): DrawCall[] {
    const canvas = padAtlas(
      image,
      layout
    ) as unknown as RecordingCanvas | null;
    assert.ok(canvas !== null, "padAtlas should have produced a canvas");

    return canvas.context.calls;
  }

  function regionPadCalls(
    layout: AtlasLayout,
    bounds: AtlasRegion
  ): DrawCall[] {
    const canvas = new RecordingCanvas();
    padAtlasRegion(
      canvas as unknown as HTMLCanvasElement,
      image,
      layout,
      bounds
    );

    return canvas.context.calls;
  }

  it("sizes the canvas from the padded layout", () => {
    padAtlas(image, kLayout);
    const canvas = createdCanvases.at(-1)!;

    assert.equal(canvas.width, kLayout.paddedWidth);
    assert.equal(canvas.height, kLayout.paddedHeight);
  });

  it("reproduces padAtlas exactly when the bounds cover the whole atlas", () => {
    const expected = fullPadCalls(kLayout);
    const actual = regionPadCalls(kLayout, kLayout.sourceBounds());

    assert.deepEqual(actual, expected);
  });

  it("redraws only the tiles the bounds touch", () => {
    const calls = regionPadCalls(kLayout, {
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
    const oneTile = regionPadCalls(kLayout, {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });
    const fourTiles = regionPadCalls(kLayout, {
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
    const calls = regionPadCalls(kLayout, {
      x: 999,
      y: 999,
      width: 4,
      height: 4
    });

    assert.deepEqual(calls, []);
  });

  it("draws nothing when padding is disabled", () => {
    const calls = regionPadCalls(
      kLayout.withoutPadding(),
      { x: 0, y: 0, width: 4, height: 4 }
    );

    assert.deepEqual(calls, []);
  });
});
