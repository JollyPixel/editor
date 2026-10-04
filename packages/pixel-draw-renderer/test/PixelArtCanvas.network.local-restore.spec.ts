// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";
import type { UVRegionData } from "#src/uv/region/UVRegion.ts";
import { makeContainer } from "./helpers/dom.ts";

describe("PixelArtCanvas — runLocalRestore", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  test("suppresses the 'texture-replaced' broadcast while still replacing the texture", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 4, y: 4 }
      },
      history: { enabled: true },
      onBufferUpdated: (event) => events.push(event)
    });

    const externalCanvas = document.createElement("canvas");
    externalCanvas.width = 8;
    externalCanvas.height = 8;
    manager.runLocalRestore(() => {
      manager.texture = externalCanvas;
    });

    assert.strictEqual(events.length, 0);
    assert.deepStrictEqual(
      manager.textureSize,
      { x: 8, y: 8 }
    );
    manager.destroy();
  });

  test("suppresses uv region broadcasts and records no history", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      history: { enabled: true },
      onBufferUpdated: (event) => events.push(event)
    });

    manager.runLocalRestore(() => {
      manager.uv.create({
        width: 4,
        height: 4
      });
    });

    assert.strictEqual(events.length, 0);
    assert.strictEqual([...manager.uv.regions].length, 1);
    assert.ok(!manager.canUndo());
    manager.destroy();
  });

  test("restores broadcasting after the scope, and on a throw", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      onBufferUpdated: (event) => events.push(event)
    });

    assert.throws(() => manager.runLocalRestore(() => {
      throw new Error("boom");
    }), /boom/);

    manager.uv.create({
      width: 4,
      height: 4
    });

    assert.deepStrictEqual(
      events.map((event) => event.action),
      ["uv-region-created"]
    );
    manager.destroy();
  });

  test("a nested scope leaves the outer one intact", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(container, {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      onBufferUpdated: (event) => events.push(event)
    });

    manager.runLocalRestore(() => {
      manager.runLocalRestore(() => void 0);
      manager.uv.create({
        width: 4,
        height: 4
      });
    });

    assert.strictEqual(events.length, 0);
    manager.destroy();
  });
});

describe("PixelArtCanvas — loadSnapshot", () => {
  test("replaces texture, UV regions and normal map silently and clears history", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = new PixelArtCanvas(makeContainer(), {
      texture: {
        maxSize: 32,
        size: { x: 8, y: 8 }
      },
      history: { enabled: true },
      onBufferUpdated: (event) => events.push(event)
    });
    manager.uv.create({
      width: 4,
      height: 4
    });
    assert.ok(manager.canUndo());
    events.length = 0;
    const snapshotRegion: UVRegionData = {
      state: "stacked",
      id: "a",
      rect: { x: 0, y: 0, width: 1, height: 1 },
      color: "#f00"
    };
    const normalMapData = NormalMapConfig.create({ strength: 3 }).toJSON();

    manager.loadSnapshot(
      { x: 2, y: 1 },
      new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]),
      [snapshotRegion],
      normalMapData
    );

    assert.deepStrictEqual(
      manager.textureSize,
      { x: 2, y: 1 }
    );
    assert.deepStrictEqual(
      [...manager.texture.subarray(4, 8)],
      [4, 5, 6, 255]
    );
    assert.deepStrictEqual(
      manager.uv.get("a")?.toJSON(),
      snapshotRegion
    );
    assert.deepStrictEqual(
      manager.document.normalMap?.toJSON(),
      normalMapData
    );
    assert.ok(!manager.canUndo());
    assert.strictEqual(events.length, 0);
    manager.destroy();
  });
});
