// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Viewport } from "../../../src/systems/rendering/Viewport.ts";
import { CanvasDimensions } from "../../../src/systems/rendering/CanvasDimensions.ts";

describe("Systems.Rendering.Viewport", () => {
  const canvas = new CanvasDimensions(800, 600);

  test("should clamp a rect outside the canvas to normalized bounds", () => {
    const viewport = new Viewport({
      x: -0.5,
      y: 0.25,
      width: 2,
      height: Number.NaN
    });

    assert.deepStrictEqual(
      [viewport.x, viewport.y, viewport.width, viewport.height],
      [0, 0.25, 1, 0]
    );
  });

  test("should measure its aspect in canvas pixels", () => {
    const left = new Viewport({
      x: 0,
      y: 0,
      width: 0.5,
      height: 1
    });

    assert.strictEqual(left.aspect(canvas), 400 / 600);
    assert.strictEqual(Viewport.full.aspect(canvas), canvas.aspect);
  });
});
