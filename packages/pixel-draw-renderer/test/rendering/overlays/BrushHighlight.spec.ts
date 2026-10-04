// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BrushHighlightView } from "#src/rendering/overlays/BrushHighlight.ts";
import {
  makeSvg,
  makeViewport,
  makeBrush
} from "../../helpers/overlay.ts";

describe("BrushHighlightView", () => {
  for (const { brushSize, transform } of [
    {
      brushSize: 1,
      transform: "translate(10, 18) scale(4)"
    },
    {
      brushSize: 2,
      transform: "translate(6, 14) scale(8)"
    }
  ]) {
    test(`update() snaps a size ${brushSize} highlight to the pixel grid of a panned camera`, () => {
      const svg = makeSvg();
      const viewport = makeViewport();
      viewport.camera = {
        x: 6,
        y: 10
      };
      const overlay = new BrushHighlightView(
        svg,
        viewport,
        makeBrush()
      );

      overlay.update(13, 21, () => brushSize);
      const group = svg.querySelector("g");

      assert.ok(group, "highlight group should exist");
      assert.strictEqual(
        group!.getAttribute("visibility"),
        "visible",
        "highlight group should be visible"
      );
      assert.strictEqual(
        group!.getAttribute("transform"),
        transform
      );
    });
  }

  test("update(null, null) hides the highlight", () => {
    const svg = makeSvg();
    const overlay = new BrushHighlightView(
      svg,
      makeViewport(),
      makeBrush()
    );

    overlay.update(10, 10, () => 1);
    overlay.update(null, null, () => 1);

    const group = svg.querySelector("g");
    assert.strictEqual(
      group!.getAttribute("visibility"),
      "hidden",
      "highlight group should be hidden"
    );
  });

  test("refresh() redraws the current cursor position with the latest size", () => {
    const svg = makeSvg();
    let brushSize = 1;
    const overlay = new BrushHighlightView(
      svg,
      makeViewport(),
      makeBrush()
    );

    overlay.update(10, 10, () => brushSize);
    brushSize = 2;
    overlay.refresh();

    const group = svg.querySelector("g");
    assert.ok(
      group?.getAttribute("transform")?.includes("scale(8)"),
      "brush highlight should be scaled by brush size"
    );
  });

  test("hide() hides the highlight", () => {
    const svg = makeSvg();
    const overlay = new BrushHighlightView(
      svg,
      makeViewport(),
      makeBrush()
    );

    overlay.update(10, 10, () => 1);
    overlay.hide();

    const group = svg.querySelector("g");
    assert.strictEqual(
      group!.getAttribute("visibility"),
      "hidden",
      "highlight group should be hidden"
    );
  });

  test("update() snaps to the cell under a cursor left of and above the texture", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    viewport.camera = {
      x: 6,
      y: 10
    };
    const overlay = new BrushHighlightView(svg, viewport, makeBrush());

    overlay.update(1, 1, () => 1);

    assert.strictEqual(svg.querySelector("g")?.getAttribute("transform"), "translate(-2, -2) scale(4)");
  });
});
