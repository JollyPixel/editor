// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import { LocalHistory } from "./helpers/history/LocalHistory.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { readPixel } from "./fixtures/canvas.ts";

// CONSTANTS
const kWhite = [255, 255, 255, 255];
const kTransparent = [0, 0, 0, 0];

function makeCanvasWithSlot(
  events: PixelCommand[] = []
): PixelArtCanvas {
  const { manager } = createPixelArtCanvas({
    history: new LocalHistory(),
    onCommand: (event) => events.push(event)
  });
  manager.uv.restore({
    id: "slot",
    color: "#00f",
    state: "unfolded",
    faces: {
      front: { x: 1, y: 1, width: 2, height: 2 },
      back: { x: 5, y: 1, width: 2, height: 2 }
    }
  });
  events.length = 0;

  return manager;
}

function pixelAt(
  manager: PixelArtCanvas,
  position: { x: number; y: number; }
): number[] {
  return readPixel(manager.texture, position, 8);
}

describe("PixelArtCanvas.clearTexture", () => {
  test("keeps slot pixels by default", () => {
    const manager = makeCanvasWithSlot();

    manager.clearTexture();

    assert.deepStrictEqual(pixelAt(manager, { x: 1, y: 1 }), kWhite);
    assert.deepStrictEqual(pixelAt(manager, { x: 6, y: 2 }), kWhite);
    assert.deepStrictEqual(pixelAt(manager, { x: 3, y: 1 }), kTransparent);
    assert.deepStrictEqual(pixelAt(manager, { x: 7, y: 7 }), kTransparent);
    manager.destroy();
  });

  test("clears every pixel with includeUV", () => {
    const manager = makeCanvasWithSlot();

    manager.clearTexture({ includeUV: true });

    assert.ok(manager.texture.every((byte) => byte === 0));
    assert.strictEqual(manager.uv.get("slot")?.id, "slot");
    manager.destroy();
  });

  test("records one texture-replaced history entry that undo reverts", () => {
    const manager = makeCanvasWithSlot();
    const before = manager.texture;

    manager.clearTexture({ includeUV: true });

    assert.ok(manager.undo());
    assert.deepStrictEqual(manager.texture, before);
    assert.ok(manager.uv.get("slot"));

    assert.ok(manager.undo());
    assert.strictEqual(manager.uv.get("slot"), undefined);
    manager.destroy();
  });

  test("emits one texture-replaced hook event with the cleared pixels", () => {
    const events: PixelCommand[] = [];
    const manager = makeCanvasWithSlot(events);

    manager.clearTexture();

    assert.deepStrictEqual(
      events.map((event) => event.action),
      ["texture-replaced"]
    );
    const [event] = events;
    assert.ok(event.action === "texture-replaced");
    assert.deepStrictEqual(event.metadata.size, { x: 8, y: 8 });
    const pixels = new Uint8ClampedArray(
      toUint8Array(event.metadata.pixels)
    );
    assert.deepStrictEqual(readPixel(pixels, { x: 1, y: 1 }, 8), kWhite);
    assert.deepStrictEqual(
      readPixel(pixels, { x: 3, y: 1 }, 8),
      kTransparent
    );
    manager.destroy();
  });

  test("emits a replaced event for the whole texture", () => {
    const manager = makeCanvasWithSlot();
    const replaced: unknown[] = [];
    manager.document.on("replaced", (event) => replaced.push(event.size));

    manager.clearTexture();

    assert.deepStrictEqual(replaced, [{ x: 8, y: 8 }]);
    manager.destroy();
  });
});
