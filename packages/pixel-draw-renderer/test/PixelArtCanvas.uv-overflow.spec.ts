// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  createUvCanvas,
  drag
} from "./helpers/uv/canvas.ts";

describe("PixelArtCanvas — uv overflow", () => {
  for (const { overflow, expected } of [
    { overflow: 0, expected: 0 },
    { overflow: 3, expected: -3 },
    { overflow: Infinity, expected: -10 }
  ]) {
    test(`dragging past the texture edge with overflow ${overflow} stops at x ${expected}`, () => {
      const manager = createUvCanvas();
      manager.mode = "uv";
      manager.uv.overflow = overflow;
      const region = manager.uv.create({ width: 4, height: 4 });
      manager.uv.select(region.id);

      drag(manager, { x: 84, y: 84 }, { x: 44, y: 84 });

      assert.deepEqual(
        manager.uv.get(region.id)!.rectFor("front"),
        { x: expected, y: 0, width: 4, height: 4 }
      );
      manager.destroy();
    });
  }

  test("outlines the overflow limit only in uv mode with a finite overflow", () => {
    const { manager, overlay } = createPixelArtCanvas({
      zoom: { default: 4 }
    });
    function outline(): SVGRectElement | null {
      return overlay.querySelector("[part='uv-overflow-limit']");
    }
    function label(): SVGTextElement | null {
      return overlay.querySelector("[part='uv-overflow-limit-label']");
    }

    manager.mode = "uv";
    assert.equal(outline(), null);

    manager.uv.overflow = 2;
    const { x, y } = manager.camera;
    const limit = outline()!;
    assert.deepEqual(
      ["x", "y", "width", "height"].map((name) => Number(limit.getAttribute(name))),
      [x - 8, y - 8, 48, 48]
    );
    assert.equal(label()!.textContent, "UV limit");
    assert.equal(Number(label()!.getAttribute("x")), x - 8);
    assert.ok(Number(label()!.getAttribute("y")) < y - 8);

    manager.uv.overflow = Infinity;
    assert.equal(outline(), null);
    assert.equal(label(), null);
    manager.uv.overflow = 2;
    manager.mode = "paint";
    assert.equal(outline(), null);
    assert.equal(label(), null);
    manager.destroy();
  });
});
