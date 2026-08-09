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
  test("update() shows the highlight group at the grid-snapped position", () => {
    const svg = makeSvg();
    const overlay = new BrushHighlightView(
      svg,
      makeViewport(),
      makeBrush(1)
    );

    overlay.update(10, 10);
    const group = svg.querySelector("g");

    assert.ok(group, "highlight group should exist");
    assert.strictEqual(
      group!.getAttribute("visibility"),
      "visible",
      "highlight group should be visible"
    );
    assert.ok(
      group!.getAttribute("transform")?.includes("scale(4)"),
      "odd brush size scales by zoom"
    );
  });

  test("update(null, null) hides the highlight", () => {
    const svg = makeSvg();
    const overlay = new BrushHighlightView(
      svg,
      makeViewport(),
      makeBrush(1)
    );

    overlay.update(10, 10);
    overlay.update(null, null);

    const group = svg.querySelector("g");
    assert.strictEqual(
      group!.getAttribute("visibility"),
      "hidden",
      "highlight group should be hidden"
    );
  });

  test("refresh() redraws the current cursor position with the latest brush size", () => {
    const svg = makeSvg();
    let brushSize = 1;
    const overlay = new BrushHighlightView(
      svg,
      makeViewport(),
      {
        get size() {
          return brushSize;
        },
        colorInline: "#fff",
        colorOutline: "#000"
      }
    );

    overlay.update(10, 10);
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
      makeBrush(1)
    );

    overlay.update(10, 10);
    overlay.hide();

    const group = svg.querySelector("g");
    assert.strictEqual(
      group!.getAttribute("visibility"),
      "hidden",
      "highlight group should be hidden"
    );
  });
});
