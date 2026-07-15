// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import { PixelWorld } from "../../src/network/PixelWorld.ts";
import { applyCommandToWorld } from "../../src/network/PixelCommandApplier.ts";
import type { PixelNetworkCommand } from "../../src/network/types.ts";

// CONSTANTS
const kHeader = { clientId: "client-A", seq: 1, timestamp: 1000 };

function makeWorld(): PixelWorld {
  return new PixelWorld();
}

describe("applyCommandToWorld — buffer-added", () => {
  test("creates a new buffer in the world", () => {
    const world = makeWorld();
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "buffer-added",
      metadata: { size: { x: 4, y: 4 } }
    });
    assert.ok(world.getBuffer("tex1"));
    assert.deepStrictEqual(world.getBuffer("tex1")!.getSize(), { x: 4, y: 4 });
  });

  test("applies initial pixels when provided", () => {
    const world = makeWorld();
    const pixels = new Uint8ClampedArray(2 * 2 * 4).fill(7);
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "buffer-added",
      metadata: { size: { x: 2, y: 2 }, pixels: fromUint8Array(new Uint8Array(pixels)) }
    });
    assert.deepStrictEqual(world.getBuffer("tex1")!.samplePixel(0, 0), [7, 7, 7, 7]);
  });

  test("is a no-op if the buffer already exists", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "tex1",
        action: "buffer-added",
        metadata: { size: { x: 8, y: 8 } }
      });
    });
    assert.deepStrictEqual(world.getBuffer("tex1")!.getSize(), { x: 4, y: 4 });
  });
});

describe("applyCommandToWorld — buffer-removed", () => {
  test("removes an existing buffer", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "buffer-removed",
      metadata: {}
    });
    assert.strictEqual(world.hasBuffer("tex1"), false);
  });

  test("is a no-op for an unknown buffer", () => {
    const world = makeWorld();
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "no-such",
        action: "buffer-removed",
        metadata: {}
      });
    });
  });
});

describe("applyCommandToWorld — stroke", () => {
  test("draws the given pixels on the buffer", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "stroke",
      metadata: {
        color: { r: 1, g: 2, b: 3, a: 255 },
        positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
      }
    });
    const buffer = world.getBuffer("tex1")!;
    assert.deepStrictEqual(buffer.samplePixel(0, 0), [1, 2, 3, 255]);
    assert.deepStrictEqual(buffer.samplePixel(1, 1), [1, 2, 3, 255]);
  });

  test("is a no-op for an unknown buffer", () => {
    const world = makeWorld();
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "no-such",
        action: "stroke",
        metadata: { color: { r: 0, g: 0, b: 0, a: 255 }, positions: [{ x: 0, y: 0 }] }
      });
    });
  });
});

describe("applyCommandToWorld — resized", () => {
  test("resizes the buffer", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "resized",
      metadata: { size: { x: 8, y: 2 } }
    });
    assert.deepStrictEqual(world.getBuffer("tex1")!.getSize(), { x: 8, y: 2 });
  });
});

describe("applyCommandToWorld — texture-replaced", () => {
  test("replaces the buffer's pixel data", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    const pixels = new Uint8ClampedArray(2 * 2 * 4).fill(9);
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "texture-replaced",
      metadata: { size: { x: 2, y: 2 }, pixels: fromUint8Array(new Uint8Array(pixels)) }
    });
    const buffer = world.getBuffer("tex1")!;
    assert.deepStrictEqual(buffer.getSize(), { x: 2, y: 2 });
    assert.deepStrictEqual(buffer.samplePixel(0, 0), [9, 9, 9, 9]);
  });
});

describe("applyCommandToWorld — all actions compile", () => {
  test("exhaustive switch: no TypeScript error for any action", () => {
    const actions: PixelNetworkCommand["action"][] = [
      "buffer-added",
      "buffer-removed",
      "stroke",
      "resized",
      "texture-replaced"
    ];
    assert.strictEqual(actions.length, 5);
  });
});
