// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SelectionSizeLabel
} from "#src/rendering/overlays/SelectionSizeLabel.ts";
import {
  makeSvg,
  makeViewport,
  makeBrush
} from "../../helpers/overlay.ts";

// CONSTANTS
// Mirrors the label's own estimate: 6.2px per glyph at font-size 10.
const kCharWidth = 6.2;

function makeLabel(
  viewport = makeViewport()
) {
  const svg = makeSvg();
  const label = new SelectionSizeLabel(
    svg,
    viewport,
    makeBrush()
  );

  return {
    svg,
    label,
    text: () => svg.querySelector("text")!
  };
}

describe("SelectionSizeLabel", () => {
  test("draw() anchors the size below the bottom-right corner", () => {
    const { label, text } = makeLabel();

    // zoom 4, camera (0,0): rect (1,1,16,16) -> right=68, bottom=68
    label.draw({
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

  test("draw() reports the bounding box of any rect, unrounded", () => {
    const { label, text } = makeLabel();

    label.draw({
      x: 0,
      y: 0,
      width: 3,
      height: 17
    });

    assert.strictEqual(text().textContent, "3×17");
  });

  test("draw() hides anything smaller than 2x2 on either axis", () => {
    const { label, text } = makeLabel();

    for (const rect of [
      { width: 1, height: 1 },
      { width: 1, height: 8 },
      { width: 8, height: 1 }
    ]) {
      label.draw({
        x: 0,
        y: 0,
        ...rect
      });

      assert.strictEqual(
        text().getAttribute("visibility"),
        "hidden",
        `${rect.width}x${rect.height} is too small to label`
      );
    }

    label.draw({
      x: 0,
      y: 0,
      width: 2,
      height: 2
    });

    assert.strictEqual(
      text().getAttribute("visibility"),
      "visible",
      "2x2 is the smallest labelled selection"
    );
  });

  test("draw() hides a previously drawn label once the rect shrinks", () => {
    const { label, text } = makeLabel();

    label.draw({
      x: 0,
      y: 0,
      width: 8,
      height: 8
    });
    label.draw({
      x: 0,
      y: 0,
      width: 8,
      height: 1
    });

    assert.strictEqual(text().getAttribute("visibility"), "hidden");
  });

  test("the label is legible over artwork via a haloed brush-colored text", () => {
    const { label, text } = makeLabel();

    label.draw({
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });

    assert.strictEqual(text().getAttribute("fill"), "#000");
    assert.strictEqual(text().getAttribute("stroke"), "#FFF");
    assert.strictEqual(text().getAttribute("paint-order"), "stroke");
  });

  test("draw() flips above the box when it would fall past the bottom", () => {
    const { label, text } = makeLabel(
      makeViewport(4, { x: 800, y: 600 })
    );

    // top=560, bottom=624: below (638) is past the 600px-tall viewport.
    label.draw({
      x: 0,
      y: 140,
      width: 16,
      height: 16
    });

    // top - gap + fontSize = 560 - 14 + 10
    assert.strictEqual(text().getAttribute("y"), "556");
  });

  test("draw() clamps the anchor so the label stays inside the left edge", () => {
    const viewport = makeViewport();
    viewport.camera.x = -10;
    const { label, text } = makeLabel(viewport);

    // right = -10 + 4*4 = 6, which would push "4×4" off the left edge.
    label.draw({
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });

    const expected = 4 + ("4×4".length * kCharWidth);
    assert.strictEqual(
      text().getAttribute("x"),
      String(expected)
    );
  });

  test("draw() hides the label when the rect left the viewport", () => {
    const { label, text } = makeLabel(
      makeViewport(4, { x: 800, y: 600 })
    );

    label.draw({
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });
    assert.strictEqual(text().getAttribute("visibility"), "visible");

    // left = 300 * 4 = 1200, past the 800px-wide viewport.
    label.draw({
      x: 300,
      y: 0,
      width: 4,
      height: 4
    });

    assert.strictEqual(text().getAttribute("visibility"), "hidden");
  });

  test("clear() hides the label", () => {
    const { label, text } = makeLabel();

    label.draw({
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });
    label.clear();

    assert.strictEqual(text().getAttribute("visibility"), "hidden");
  });
});
