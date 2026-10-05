// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SizeLabel } from "#src/rendering/overlays/SizeLabel.ts";
import {
  makeSvg,
  makeViewport
} from "../../helpers/overlay.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
const kLabelGlyphWidthEstimate = 6.2;

function makeLabel(
  viewport = makeViewport()
) {
  const svg = makeSvg();
  const label = new SizeLabel(viewport, {
    overlay: "size",
    fill: "#000",
    stroke: "#FFF"
  });
  label.appendTo(svg);

  return {
    svg,
    label,
    text: () => svg.querySelector("text")!
  };
}

function showOutside(
  label: SizeLabel,
  rect: SelectionRect
): void {
  label.show(label.outside(rect));
}

describe("SizeLabel", () => {
  test("outside() anchors the size below the bottom-right corner", () => {
    const { label, text } = makeLabel();

    showOutside(label, {
      x: 1,
      y: 1,
      width: 16,
      height: 16
    });

    assert.strictEqual(text().textContent, "16×16");
    assert.strictEqual(text().getAttribute("visibility"), "visible");
    assert.strictEqual(text().getAttribute("text-anchor"), "end");
    assert.strictEqual(text().getAttribute("x"), "68");
    assert.strictEqual(text().getAttribute("y"), "82");
  });

  test("outside() reports the bounding box of any rect, unrounded", () => {
    const { label, text } = makeLabel();

    showOutside(label, {
      x: 0,
      y: 0,
      width: 3,
      height: 17
    });

    assert.strictEqual(text().textContent, "3×17");
  });

  test("outside() labels a 1x1 rect", () => {
    const { label, text } = makeLabel();

    showOutside(label, {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    });

    assert.strictEqual(text().textContent, "1×1");
    assert.strictEqual(text().getAttribute("visibility"), "visible");
  });

  test("the label is legible over artwork via haloed text in its paint colors", () => {
    const { label, text } = makeLabel();

    showOutside(label, {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });

    assert.strictEqual(text().getAttribute("fill"), "#000");
    assert.strictEqual(text().getAttribute("stroke"), "#FFF");
    assert.strictEqual(text().getAttribute("paint-order"), "stroke");
  });

  test("outside() flips above the box when it would fall past the bottom", () => {
    const { label, text } = makeLabel(
      makeViewport(4, { x: 800, y: 600 })
    );

    showOutside(label, {
      x: 0,
      y: 140,
      width: 16,
      height: 16
    });

    assert.strictEqual(text().getAttribute("y"), "556");
  });

  test("outside() clamps the anchor so the label stays inside the left edge", () => {
    const viewport = makeViewport();
    viewport.camera.x = -10;
    const { label, text } = makeLabel(viewport);

    showOutside(label, {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });

    const expected = 4 + ("4×4".length * kLabelGlyphWidthEstimate);
    assert.strictEqual(
      text().getAttribute("x"),
      String(expected)
    );
  });

  test("outside() hides the label when the rect left the viewport", () => {
    const { label, text } = makeLabel(
      makeViewport(4, { x: 800, y: 600 })
    );

    showOutside(label, {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });
    assert.strictEqual(text().getAttribute("visibility"), "visible");

    showOutside(label, {
      x: 300,
      y: 0,
      width: 4,
      height: 4
    });

    assert.strictEqual(text().getAttribute("visibility"), "hidden");
  });

  test("outside() bounds are the screen box the label covers", () => {
    const { label } = makeLabel();
    const width = "16×16".length * kLabelGlyphWidthEstimate;

    assert.deepStrictEqual(
      label.outside({ x: 1, y: 1, width: 16, height: 16 })?.bounds,
      { x: 68 - width, y: 72, width, height: 10 }
    );
  });

  test("clear() hides the label", () => {
    const { label, text } = makeLabel();

    showOutside(label, {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });
    label.clear();

    assert.strictEqual(text().getAttribute("visibility"), "hidden");
  });

  test("inside() anchors the size inside the bottom-right corner", () => {
    const { label, text } = makeLabel();

    label.show(label.inside({ x: 1, y: 1, width: 16, height: 16 }));

    assert.strictEqual(text().textContent, "16×16");
    assert.strictEqual(text().getAttribute("x"), "62");
    assert.strictEqual(text().getAttribute("y"), "62");
    assert.strictEqual(text().getAttribute("text-anchor"), "end");
  });

  test("inside() needs room for the text and both insets", () => {
    const { label } = makeLabel();

    assert.notStrictEqual(label.inside({ x: 0, y: 0, width: 7, height: 5 }), null);
    assert.strictEqual(label.inside({ x: 0, y: 0, width: 6, height: 5 }), null);
    assert.strictEqual(label.inside({ x: 0, y: 0, width: 7, height: 4 }), null);
  });

  test("insideTriangle() stacks the size below the lines kept at a top corner", () => {
    const { label, text } = makeLabel();

    label.show(label.insideTriangle(
      { x: 0, y: 0, width: 16, height: 16 },
      "top-left",
      1
    ));

    assert.strictEqual(text().getAttribute("x"), "3");
    assert.strictEqual(text().getAttribute("y"), "23");
    assert.strictEqual(text().getAttribute("text-anchor"), "start");
  });

  test("insideTriangle() stacks the size above the lines kept at a bottom corner", () => {
    const { label, text } = makeLabel();

    label.show(label.insideTriangle(
      { x: 0, y: 0, width: 24, height: 24 },
      "bottom-right",
      1
    ));

    assert.strictEqual(text().getAttribute("x"), "90");
    assert.strictEqual(text().getAttribute("y"), "80");
    assert.strictEqual(text().getAttribute("text-anchor"), "end");
  });

  test("insideTriangle() rejects a size that would cross the hypotenuse", () => {
    const { label } = makeLabel();
    const rect = { x: 0, y: 0, width: 16, height: 16 };

    assert.notStrictEqual(label.insideTriangle(rect, "top-left", 1), null);
    assert.strictEqual(label.insideTriangle(rect, "top-left", 2), null);
    assert.strictEqual(
      label.insideTriangle({ ...rect, width: 8 }, "top-left", 0),
      null
    );
  });

  test("show() restores the end anchor after a start placement", () => {
    const { label, text } = makeLabel();
    const rect = {
      x: 0,
      y: 0,
      width: 16,
      height: 16
    };

    label.show(label.insideTriangle(rect, "top-left", 0));
    showOutside(label, rect);

    assert.strictEqual(text().getAttribute("text-anchor"), "end");
  });

  test("paint() recolors the label and remove() detaches it", () => {
    const { svg, label, text } = makeLabel();

    label.paint({ fill: "#f00", stroke: "#0f0" });

    assert.strictEqual(text().getAttribute("fill"), "#f00");
    assert.strictEqual(text().getAttribute("stroke"), "#0f0");

    label.remove();

    assert.strictEqual(svg.querySelector("text"), null);
  });
});
