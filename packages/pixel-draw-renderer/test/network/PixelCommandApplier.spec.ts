// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import { applyCommandToBuffer } from "#src/network/PixelCommandApplier.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

function makeBuffer(
  size = { x: 4, y: 4 }
): PixelBuffer {
  return new PixelBuffer({ size });
}

describe("applyCommandToBuffer — stroke", () => {
  test("draws the given pixels on the buffer", () => {
    const buffer = makeBuffer();
    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "stroke",
      metadata: {
        color: { r: 1, g: 2, b: 3, a: 255 },
        positions: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ]
      }
    });
    assert.deepStrictEqual(
      buffer.samplePixel(0, 0),
      [1, 2, 3, 255]
    );
    assert.deepStrictEqual(
      buffer.samplePixel(1, 1),
      [1, 2, 3, 255]
    );
  });
});

describe("applyCommandToBuffer — resized", () => {
  test("resizes the buffer", () => {
    const buffer = makeBuffer();
    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "resized",
      metadata: { size: { x: 8, y: 2 } }
    });
    assert.deepStrictEqual(
      buffer.size(),
      { x: 8, y: 2 }
    );
  });
});

describe("applyCommandToBuffer — texture-replaced", () => {
  test("replaces the buffer's pixel data", () => {
    const buffer = makeBuffer();
    const pixels = new Uint8ClampedArray(
      2 * 2 * 4
    ).fill(9);
    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "texture-replaced",
      metadata: {
        size: { x: 2, y: 2 },
        pixels: fromUint8Array(new Uint8Array(pixels))
      }
    });
    assert.deepStrictEqual(
      buffer.size(),
      { x: 2, y: 2 }
    );
    assert.deepStrictEqual(
      buffer.samplePixel(0, 0),
      [9, 9, 9, 9]
    );
  });
});

describe("applyCommandToBuffer — global-fill", () => {
  test("recomputes matching pixels from fromColor and repaints them toColor", () => {
    const buffer = makeBuffer({ x: 3, y: 1 });
    buffer.drawPixels([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ], { r: 1, g: 2, b: 3, a: 255 });

    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "global-fill",
      metadata: {
        fromColor: { r: 1, g: 2, b: 3, a: 255 },
        toColor: { r: 9, g: 8, b: 7, a: 255 }
      }
    });

    assert.deepStrictEqual(
      buffer.samplePixel(0, 0),
      [9, 8, 7, 255]
    );
    assert.deepStrictEqual(
      buffer.samplePixel(1, 0),
      [9, 8, 7, 255]
    );
    assert.deepStrictEqual(
      buffer.samplePixel(2, 0),
      [9, 8, 7, 255]
    );
  });

  test("only touches pixels currently matching fromColor, leaving others untouched", () => {
    const buffer = makeBuffer({ x: 2, y: 1 });
    buffer.drawPixels([
      { x: 0, y: 0 }
    ], { r: 1, g: 2, b: 3, a: 255 });
    buffer.drawPixels([
      { x: 1, y: 0 }
    ], { r: 9, g: 9, b: 9, a: 255 });

    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "global-fill",
      metadata: {
        fromColor: { r: 1, g: 2, b: 3, a: 255 },
        toColor: { r: 0, g: 0, b: 0, a: 255 }
      }
    });

    assert.deepStrictEqual(
      buffer.samplePixel(0, 0),
      [0, 0, 0, 255]
    );
    assert.deepStrictEqual(
      buffer.samplePixel(1, 0),
      [9, 9, 9, 255]
    );
  });
});

describe("applyCommandToBuffer — select-edit", () => {
  test("writes each position's own color, not a uniform one", () => {
    const buffer = makeBuffer();
    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "select-edit",
      metadata: {
        positions: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        colors: [
          { r: 1, g: 2, b: 3, a: 255 },
          { r: 9, g: 8, b: 7, a: 255 }
        ]
      }
    });
    assert.deepStrictEqual(
      buffer.samplePixel(0, 0),
      [1, 2, 3, 255]
    );
    assert.deepStrictEqual(
      buffer.samplePixel(1, 0),
      [9, 8, 7, 255]
    );
  });
});

describe("applyCommandToBuffer — uv-region-created", () => {
  test("stores the region on the buffer", () => {
    const buffer = makeBuffer();
    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "uv-region-created",
      metadata: {
        region: {
          id: "r1",
          rect: { x: 0, y: 0, width: 2, height: 2 },
          color: "#f00"
        }
      }
    });

    assert.deepStrictEqual(buffer.uvRegions.get("r1"), {
      id: "r1",
      rect: { x: 0, y: 0, width: 2, height: 2 },
      color: "#f00"
    });
  });
});

describe("applyCommandToBuffer — uv-region-deleted", () => {
  test("removes the region from the buffer", () => {
    const buffer = makeBuffer();
    buffer.uvRegions.set({
      id: "r1",
      rect: { x: 0, y: 0, width: 2, height: 2 },
      color: "#f00"
    });

    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "uv-region-deleted",
      metadata: { id: "r1" }
    });

    assert.strictEqual(
      buffer.uvRegions.get("r1"),
      undefined
    );
  });

  test("is a no-op for an unknown region", () => {
    const buffer = makeBuffer();
    assert.doesNotThrow(() => {
      applyCommandToBuffer(buffer, {
        ...kHeader,
        action: "uv-region-deleted",
        metadata: { id: "no-such-region" }
      });
    });
  });
});

describe("applyCommandToBuffer — uv-region-moved", () => {
  test("updates the region's rect, preserving its color", () => {
    const buffer = makeBuffer({ x: 8, y: 8 });
    buffer.uvRegions.set({
      id: "r1",
      rect: { x: 0, y: 0, width: 2, height: 2 },
      color: "#f00"
    });

    applyCommandToBuffer(buffer, {
      ...kHeader,
      action: "uv-region-moved",
      metadata: {
        id: "r1",
        rect: { x: 4, y: 4, width: 2, height: 2 }
      }
    });

    assert.deepStrictEqual(buffer.uvRegions.get("r1"), {
      id: "r1",
      rect: { x: 4, y: 4, width: 2, height: 2 },
      color: "#f00"
    });
  });

  test("is a no-op for an unknown region", () => {
    const buffer = makeBuffer({ x: 8, y: 8 });
    assert.doesNotThrow(() => {
      applyCommandToBuffer(buffer, {
        ...kHeader,
        action: "uv-region-moved",
        metadata: {
          id: "no-such-region",
          rect: { x: 0, y: 0, width: 1, height: 1 }
        }
      });
    });
  });
});

describe("applyCommandToBuffer — all actions compile", () => {
  test("exhaustive switch: no TypeScript error for any action", () => {
    const actions: PixelNetworkCommand["action"][] = [
      "stroke",
      "select-edit",
      "resized",
      "texture-replaced",
      "global-fill",
      "uv-region-created",
      "uv-region-deleted",
      "uv-region-moved"
    ];
    assert.strictEqual(actions.length, 8);
  });
});
