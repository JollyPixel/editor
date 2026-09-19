// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  encodePixelBytes,
  PixelBuffer,
  UVRegion
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyCommandToBuffer } from "#src/network/PixelCommandApplier.ts";
import {
  command,
  freeRegion,
  gray,
  stackedRegion
} from "../fixtures/commands.ts";

function makeBuffer(
  size = { x: 8, y: 8 }
): PixelBuffer {
  return new PixelBuffer({ size });
}

describe("applyCommandToBuffer", () => {
  test("stroke draws its color at every position", () => {
    const buffer = makeBuffer();

    applyCommandToBuffer(buffer, command("stroke", {
      color: { r: 1, g: 2, b: 3, a: 255 },
      positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    }));

    assert.deepStrictEqual(buffer.samplePixel(0, 0), [1, 2, 3, 255]);
    assert.deepStrictEqual(buffer.samplePixel(1, 1), [1, 2, 3, 255]);
  });

  test("select-edit writes each position's own color", () => {
    const buffer = makeBuffer();

    applyCommandToBuffer(buffer, command("select-edit", {
      positions: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      colors: [gray(1), gray(9)]
    }));

    assert.deepStrictEqual(buffer.samplePixel(0, 0), [1, 1, 1, 255]);
    assert.deepStrictEqual(buffer.samplePixel(1, 0), [9, 9, 9, 255]);
  });

  test("resized resizes the buffer", () => {
    const buffer = makeBuffer();

    applyCommandToBuffer(buffer, command("resized", { size: { x: 8, y: 2 } }));

    assert.deepStrictEqual(buffer.size(), { x: 8, y: 2 });
  });

  test("texture-replaced replaces the buffer size and pixels", () => {
    const buffer = makeBuffer();
    const pixels = new Uint8Array(2 * 2 * 4).fill(9);

    applyCommandToBuffer(buffer, command("texture-replaced", {
      size: { x: 2, y: 2 },
      pixels: encodePixelBytes(pixels)
    }));

    assert.deepStrictEqual(buffer.size(), { x: 2, y: 2 });
    assert.deepStrictEqual(buffer.samplePixel(0, 0), [9, 9, 9, 9]);
  });

  test("global-fill repaints only the pixels matching fromColor", () => {
    const buffer = makeBuffer({ x: 3, y: 1 });
    buffer.drawPixels([{ x: 0, y: 0 }, { x: 1, y: 0 }], gray(1));
    buffer.drawPixels([{ x: 2, y: 0 }], gray(5));

    applyCommandToBuffer(buffer, command("global-fill", {
      fromColor: gray(1),
      toColor: gray(9)
    }));

    assert.deepStrictEqual(buffer.samplePixel(0, 0), [9, 9, 9, 255]);
    assert.deepStrictEqual(buffer.samplePixel(1, 0), [9, 9, 9, 255]);
    assert.deepStrictEqual(buffer.samplePixel(2, 0), [5, 5, 5, 255]);
  });

  test("uv-region-created stores the region", () => {
    const buffer = makeBuffer();

    applyCommandToBuffer(buffer, command("uv-region-created", { region: stackedRegion("r1") }));

    assert.deepStrictEqual(buffer.uvRegions.get("r1")?.toJSON(), stackedRegion("r1"));
  });

  test("uv-region-deleted removes the region", () => {
    const buffer = makeBuffer();
    buffer.uvRegions.set(stackedRegion("r1"));

    applyCommandToBuffer(buffer, command("uv-region-deleted", { id: "r1" }));

    assert.strictEqual(buffer.uvRegions.get("r1"), undefined);
  });

  test("uv-region-moved updates the region rect and keeps its color", () => {
    const buffer = makeBuffer();
    const rect = { x: 4, y: 4, width: 2, height: 2 };
    buffer.uvRegions.set(stackedRegion("r1"));

    applyCommandToBuffer(buffer, command("uv-region-moved", { id: "r1", face: null, rect }));

    assert.deepStrictEqual(buffer.uvRegions.get("r1")?.toJSON(), stackedRegion("r1", rect));
  });

  test("uv-region-moved moves a single face of a free region", () => {
    const buffer = makeBuffer();
    buffer.uvRegions.set(new UVRegion(stackedRegion("r1")).free());

    applyCommandToBuffer(buffer, command("uv-region-moved", {
      id: "r1",
      face: "top",
      rect: { x: 4, y: 4, width: 2, height: 2 }
    }));

    const region = buffer.uvRegions.get("r1")!;
    assert.deepStrictEqual(region.rectFor("top"), { x: 4, y: 4, width: 2, height: 2 });
    assert.deepStrictEqual(region.rectFor("front"), { x: 0, y: 0, width: 2, height: 2 });
  });

  test("uv-region-state-changed replaces the stored region", () => {
    const buffer = makeBuffer();
    buffer.uvRegions.set(stackedRegion("r1"));

    applyCommandToBuffer(buffer, command("uv-region-state-changed", { region: freeRegion("r1") }));

    assert.strictEqual(buffer.uvRegions.get("r1")?.state, "free");
  });

  test("region commands for an unknown region are no-ops", () => {
    const buffer = makeBuffer();

    assert.doesNotThrow(() => {
      applyCommandToBuffer(buffer, command("uv-region-deleted", { id: "missing" }));
      applyCommandToBuffer(buffer, command("uv-region-moved", {
        id: "missing",
        face: null,
        rect: { x: 0, y: 0, width: 1, height: 1 }
      }));
    });
  });
});

describe("applyCommandToBuffer — uv rotation", () => {
  test("uv-region-moved keeps the stored size", () => {
    const buffer = makeBuffer();
    buffer.uvRegions.set(new UVRegion(stackedRegion("r1")).rotated("cw"));

    applyCommandToBuffer(buffer, command("uv-region-moved", {
      id: "r1",
      face: null,
      rect: { x: 4, y: 4, width: 6, height: 1 }
    }));

    assert.deepStrictEqual(
      buffer.uvRegions.get("r1")!.geometryFor("front"),
      { x: 4, y: 4, width: 2, height: 2, rotation: 1 }
    );
  });

  test("a slot rotation replaces only that slot geometry", () => {
    const buffer = makeBuffer();
    buffer.uvRegions.set(freeRegion("r1"));
    const geometry = { x: 0, y: 0, width: 2, height: 2, rotation: 1 as const };

    applyCommandToBuffer(buffer, command("uv-region-rotated", {
      id: "r1",
      face: "top",
      geometry
    }));

    const region = buffer.uvRegions.get("r1")!;
    assert.deepStrictEqual(region.geometryFor("top"), geometry);
    assert.strictEqual(region.geometryFor("front").rotation, undefined);
  });

  test("a region rotation replaces the stored region", () => {
    const buffer = makeBuffer();
    buffer.uvRegions.set(stackedRegion("r1"));
    const rotated = new UVRegion(stackedRegion("r1")).rotated("ccw").toJSON();

    applyCommandToBuffer(buffer, command("uv-region-rotated", {
      id: "r1",
      face: null,
      region: rotated
    }));

    assert.deepStrictEqual(buffer.uvRegions.get("r1")!.toJSON(), rotated);
  });

  test("a slot rotation of an unknown region is a no-op", () => {
    const buffer = makeBuffer();

    assert.doesNotThrow(() => applyCommandToBuffer(buffer, command("uv-region-rotated", {
      id: "missing",
      face: "top",
      geometry: { x: 0, y: 0, width: 1, height: 1 }
    })));
  });
});
