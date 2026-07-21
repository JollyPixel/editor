// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import { PixelWorld } from "#src/network/PixelWorld.ts";
import { applyCommandToWorld } from "#src/network/PixelCommandApplier.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

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
    assert.deepStrictEqual(
      world.getBuffer("tex1")!.size(),
      { x: 4, y: 4 }
    );
  });

  test("applies initial pixels when provided", () => {
    const world = makeWorld();
    const pixels = new Uint8ClampedArray(
      2 * 2 * 4
    ).fill(7);
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "buffer-added",
      metadata: {
        size: { x: 2, y: 2 },
        pixels: fromUint8Array(new Uint8Array(pixels))
      }
    });
    assert.deepStrictEqual(
      world.getBuffer("tex1")!.samplePixel(0, 0),
      [7, 7, 7, 7]
    );
  });

  test("is a no-op if the buffer already exists", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "tex1",
        action: "buffer-added",
        metadata: {
          size: { x: 8, y: 8 }
        }
      });
    });
    assert.deepStrictEqual(
      world.getBuffer("tex1")!.size(),
      { x: 4, y: 4 }
    );
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
    assert.ok(!world.hasBuffer("tex1"));
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
        positions: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ]
      }
    });
    const buffer = world.getBuffer("tex1")!;
    assert.deepStrictEqual(
      buffer.samplePixel(0, 0),
      [1, 2, 3, 255]
    );
    assert.deepStrictEqual(
      buffer.samplePixel(1, 1),
      [1, 2, 3, 255]
    );
  });

  test("is a no-op for an unknown buffer", () => {
    const world = makeWorld();
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "no-such",
        action: "stroke",
        metadata: {
          color: { r: 0, g: 0, b: 0, a: 255 },
          positions: [
            { x: 0, y: 0 }
          ]
        }
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
    assert.deepStrictEqual(
      world.getBuffer("tex1")!.size(),
      { x: 8, y: 2 }
    );
  });
});

describe("applyCommandToWorld — texture-replaced", () => {
  test("replaces the buffer's pixel data", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    const pixels = new Uint8ClampedArray(
      2 * 2 * 4
    ).fill(9);
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "texture-replaced",
      metadata: {
        size: { x: 2, y: 2 },
        pixels: fromUint8Array(new Uint8Array(pixels))
      }
    });
    const buffer = world.getBuffer("tex1")!;
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

describe("applyCommandToWorld — global-fill", () => {
  test("recomputes matching pixels from fromColor and repaints them toColor", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 3, y: 1 } });
    const buffer = world.getBuffer("tex1")!;
    buffer.drawPixels([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ], { r: 1, g: 2, b: 3, a: 255 });

    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
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
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 2, y: 1 } });
    const buffer = world.getBuffer("tex1")!;
    buffer.drawPixels([
      { x: 0, y: 0 }
    ], { r: 1, g: 2, b: 3, a: 255 });
    buffer.drawPixels([
      { x: 1, y: 0 }
    ], { r: 9, g: 9, b: 9, a: 255 });

    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
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

  test("is a no-op for an unknown buffer", () => {
    const world = makeWorld();
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "no-such",
        action: "global-fill",
        metadata: {
          fromColor: { r: 0, g: 0, b: 0, a: 255 },
          toColor: { r: 1, g: 1, b: 1, a: 255 }
        }
      });
    });
  });
});

describe("applyCommandToWorld — uv-region-created", () => {
  test("stores the region on the buffer", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "uv-region-created",
      metadata: {
        region: {
          id: "r1",
          rect: { x: 0, y: 0, width: 2, height: 2 },
          color: "#f00"
        }
      }
    });

    const buffer = world.getBuffer("tex1")!;
    assert.deepStrictEqual(buffer.uvRegions.get("r1"), {
      id: "r1",
      rect: { x: 0, y: 0, width: 2, height: 2 },
      color: "#f00"
    });
  });

  test("is a no-op for an unknown buffer", () => {
    const world = makeWorld();
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "no-such",
        action: "uv-region-created",
        metadata: {
          region: {
            id: "r1",
            rect: {
              x: 0, y: 0, width: 2, height: 2
            },
            color: "#f00"
          }
        }
      });
    });
  });
});

describe("applyCommandToWorld — uv-region-deleted", () => {
  test("removes the region from the buffer", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    const buffer = world.getBuffer("tex1")!;
    buffer.uvRegions.set({
      id: "r1",
      rect: { x: 0, y: 0, width: 2, height: 2 },
      color: "#f00"
    });

    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
      action: "uv-region-deleted",
      metadata: { id: "r1" }
    });

    assert.strictEqual(
      buffer.uvRegions.get("r1"),
      undefined
    );
  });

  test("is a no-op for an unknown region", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "tex1",
        action: "uv-region-deleted",
        metadata: { id: "no-such-region" }
      });
    });
  });
});

describe("applyCommandToWorld — uv-region-moved", () => {
  test("updates the region's rect, preserving its color", () => {
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 8, y: 8 } });
    const buffer = world.getBuffer("tex1")!;
    buffer.uvRegions.set({
      id: "r1",
      rect: { x: 0, y: 0, width: 2, height: 2 },
      color: "#f00"
    });

    applyCommandToWorld(world, {
      ...kHeader,
      bufferId: "tex1",
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
    const world = makeWorld();
    world.addBuffer("tex1", { size: { x: 8, y: 8 } });
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        ...kHeader,
        bufferId: "tex1",
        action: "uv-region-moved",
        metadata: {
          id: "no-such-region",
          rect: { x: 0, y: 0, width: 1, height: 1 }
        }
      });
    });
  });
});

describe("applyCommandToWorld — all actions compile", () => {
  test("exhaustive switch: no TypeScript error for any action", () => {
    const actions: PixelNetworkCommand["action"][] = [
      "buffer-added",
      "buffer-removed",
      "stroke",
      "resized",
      "texture-replaced",
      "global-fill",
      "uv-region-created",
      "uv-region-deleted",
      "uv-region-moved"
    ];
    assert.strictEqual(actions.length, 9);
  });
});
