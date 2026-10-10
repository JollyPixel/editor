// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import {
  canvasPixels,
  readPixel
} from "./fixtures/canvas.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import { FakeFrames } from "./helpers/frames.ts";
import {
  paintHorizontalPair,
  selectHorizontalPair
} from "./helpers/select.ts";

// CONSTANTS
const kContainerSize = 200;
const kFlatNormal = [128, 128, 255, 255];

function createCanvas(): PixelArtCanvas {
  const { manager } = createPixelArtCanvas({
    texture: {
      defaultColor: "#808080"
    },
    zoom: { default: 4 }
  });

  return manager;
}

function shownPixel(
  manager: PixelArtCanvas,
  x: number,
  y: number
): number[] {
  return readPixel(
    canvasPixels(manager.canvas()),
    { x, y },
    kContainerSize
  );
}

function texturePixel(
  manager: PixelArtCanvas,
  x: number,
  y: number
): number[] {
  return readPixel(manager.texture, { x, y }, 8);
}

describe("PixelArtCanvas texture view", () => {
  test("starts on the albedo view", () => {
    const manager = createCanvas();

    assert.equal(manager.textureView, "albedo");
    assert.deepEqual(shownPixel(manager, 0, 0), [128, 128, 128, 255]);
  });

  test("the normal view draws the normal map in place of the texture", () => {
    const manager = createCanvas();
    manager.document.enableNormalMap();

    manager.textureView = "normal";

    assert.equal(manager.textureView, "normal");
    assert.deepEqual(shownPixel(manager, 0, 0), kFlatNormal);

    manager.textureView = "albedo";

    assert.deepEqual(shownPixel(manager, 0, 0), [128, 128, 128, 255]);
  });

  test("the normal view follows pixel changes on the next frame", (t) => {
    const frames = new FakeFrames(t);
    const manager = createCanvas();
    manager.document.enableNormalMap();
    manager.textureView = "normal";

    manager.brush.primary.set("#ffffff");
    manager.commitPixels([{ x: 3, y: 3 }]);
    assert.deepEqual(shownPixel(manager, 2, 3), kFlatNormal);
    frames.run();

    assert.notDeepEqual(shownPixel(manager, 2, 3), kFlatNormal);
  });

  test("retains the normal map only while the normal view is shown", () => {
    const manager = createCanvas();
    const normals = manager.document.normals;

    manager.textureView = "normal";
    assert.equal(normals.retained, true);

    manager.textureView = "albedo";
    assert.equal(normals.retained, false);

    manager.textureView = "normal";
    manager.destroy();
    assert.equal(normals.retained, false);
  });

  test("shows a normal map another consumer already retained", () => {
    const manager = createCanvas();
    manager.document.enableNormalMap();
    const release = manager.document.normals.retain();
    manager.document.normals.flush();

    manager.textureView = "normal";

    assert.deepEqual(shownPixel(manager, 0, 0), kFlatNormal);
    release();
  });

  test("entering the normal view leaves a pixel-writing mode for move", () => {
    const manager = createCanvas();
    manager.mode = "fill";

    manager.textureView = "normal";

    assert.equal(manager.mode, "move");
  });

  test("leaving the normal view restores the mode it displaced", () => {
    const manager = createCanvas();
    manager.mode = "fill";
    manager.textureView = "normal";

    manager.textureView = "albedo";

    assert.equal(manager.mode, "fill");
  });

  test("a mode chosen in the normal view outlives it", () => {
    const manager = createCanvas();
    manager.mode = "fill";
    manager.textureView = "normal";
    manager.mode = "select";

    manager.textureView = "albedo";

    assert.equal(manager.mode, "select");
  });

  test("the normal view is read-only for pixels", () => {
    const manager = createCanvas();
    assert.equal(manager.pixelsReadOnly, false);
    assert.equal(manager.unavailableModes.size, 0);

    manager.textureView = "normal";

    assert.equal(manager.pixelsReadOnly, true);
    assert.deepEqual(
      [...manager.unavailableModes],
      ["paint", "erase", "fill"]
    );
    assert.equal(manager.unavailableModes, manager.unavailableModes);
  });

  test("the normal view refuses the pixel-writing modes", () => {
    const manager = createCanvas();
    manager.textureView = "normal";

    for (const mode of ["paint", "erase", "fill"] as const) {
      manager.mode = mode;
      assert.equal(manager.mode, "move");
    }

    manager.mode = "select";
    assert.equal(manager.mode, "select");

    manager.textureView = "albedo";
    manager.mode = "paint";
    assert.equal(manager.mode, "paint");
  });

  for (const [cause, makeReadOnly] of [
    ["the normal view", (manager: PixelArtCanvas) => {
      manager.textureView = "normal";
    }],
    ["a pixel lock", (manager: PixelArtCanvas) => {
      manager.pixelsLocked = true;
    }]
  ] as const) {
    test(`a selection cannot change pixels under ${cause}`, () => {
      const manager = createCanvas();
      const canvas = manager.canvas();
      paintHorizontalPair(manager);
      makeReadOnly(manager);
      manager.mode = "select";

      selectHorizontalPair(canvas);
      assert.equal(manager.tools.select.hasSelection, true);

      assert.equal(manager.shortcuts.delete(), false);
      assert.equal(manager.shortcuts.rotate("cw"), false);
      assert.equal(manager.shortcuts.flipHorizontal(), false);
      assert.equal(manager.shortcuts.flipVertical(), false);

      canvas.dispatchEvent(mouseEvent("mousedown", 94, 94));
      canvas.dispatchEvent(mouseEvent("mousemove", 94, 102));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.deepEqual(texturePixel(manager, 2, 2), [0, 0, 0, 255]);
      assert.deepEqual(texturePixel(manager, 3, 2), [255, 0, 0, 255]);
      assert.deepEqual(texturePixel(manager, 2, 4), [128, 128, 128, 255]);
    });
  }

  test("entering the normal view drops the current selection", () => {
    const manager = createCanvas();
    paintHorizontalPair(manager);
    manager.mode = "select";
    selectHorizontalPair(manager.canvas());

    manager.textureView = "normal";

    assert.equal(manager.tools.select.hasSelection, false);
  });

  test("paste is refused in the normal view", async() => {
    const manager = createCanvas();
    manager.textureView = "normal";

    const result = await manager.pasteClipboard();

    assert.deepEqual(result, {
      operation: "paste",
      code: "paste-failed"
    });
    assert.equal(manager.mode, "move");
  });
});

describe("PixelArtCanvas pixel lock", () => {
  test("refuses the pixel-writing modes and restores the displaced one", () => {
    const manager = createCanvas();
    manager.mode = "fill";

    manager.pixelsLocked = true;

    assert.equal(manager.pixelsReadOnly, true);
    assert.equal(manager.mode, "move");
    manager.mode = "paint";
    assert.equal(manager.mode, "move");

    manager.pixelsLocked = false;

    assert.equal(manager.pixelsReadOnly, false);
    assert.equal(manager.mode, "fill");
  });

  test("keeps pixels read-only when the normal view closes", () => {
    const manager = createCanvas();
    manager.pixelsLocked = true;
    manager.textureView = "normal";

    manager.textureView = "albedo";

    assert.equal(manager.pixelsReadOnly, true);
    manager.mode = "paint";
    assert.equal(manager.mode, "move");
  });

  test("unlocking in the normal view keeps pixels read-only", () => {
    const manager = createCanvas();
    manager.textureView = "normal";
    manager.pixelsLocked = true;

    manager.pixelsLocked = false;

    assert.equal(manager.pixelsReadOnly, true);
    manager.textureView = "albedo";
    assert.equal(manager.pixelsReadOnly, false);
  });
});
