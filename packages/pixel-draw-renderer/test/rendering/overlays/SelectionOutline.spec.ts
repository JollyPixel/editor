// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SelectionOutline
} from "#src/rendering/overlays/SelectionOutline.ts";
import {
  makeSvg,
  makeViewport,
  makeBrush
} from "../../helpers/overlay.ts";

function makeOutline(
  viewport = makeViewport()
): { svg: SVGElement; overlay: SelectionOutline; } {
  const svg = makeSvg();

  return {
    svg,
    overlay: new SelectionOutline(svg, viewport, makeBrush())
  };
}

describe("SelectionOutline", () => {
  test("draw() shows a dashed outline+inline path pair around the rect in screen space", () => {
    const { svg, overlay } = makeOutline();

    overlay.draw({ x: 1, y: 1, width: 2, height: 3 });

    const paths = svg.querySelectorAll("path");
    assert.strictEqual(paths.length, 2, "one outline path + one inline path");
    for (const path of paths) {
      assert.strictEqual(path.getAttribute("visibility"), "visible");
      assert.strictEqual(path.getAttribute("d"), "M 4 4 L 12 4 L 12 16 L 4 16 Z");
      assert.ok(path.getAttribute("stroke-dasharray"), "should be dashed");
    }
  });

  test("a full-true mask draws the same rectangle as no mask", () => {
    const { svg, overlay } = makeOutline();
    const rect = { x: 1, y: 1, width: 2, height: 3 };

    overlay.draw(rect);
    const plain = svg.querySelector("path")?.getAttribute("d");
    overlay.draw(rect, Array.from({ length: 6 }, () => true));

    assert.strictEqual(svg.querySelector("path")?.getAttribute("d"), plain);
  });

  test("a partial mask traces the mask contour in screen space", () => {
    const viewport = makeViewport();
    viewport.camera = { x: 3, y: -5 };
    const { svg, overlay } = makeOutline(viewport);

    overlay.draw({ x: 1, y: 2, width: 2, height: 2 }, [
      true, false,
      false, false
    ]);

    for (const path of svg.querySelectorAll("path")) {
      assert.strictEqual(path.getAttribute("visibility"), "visible");
      assert.strictEqual(path.getAttribute("d"), "M 7 3 L 11 3 L 11 7 L 7 7 Z");
    }
  });

  test("clear() hides the path pair", () => {
    const { svg, overlay } = makeOutline();

    overlay.draw({ x: 0, y: 0, width: 2, height: 2 }, [true, false, false, false]);
    overlay.clear();

    for (const path of svg.querySelectorAll("path")) {
      assert.strictEqual(path.getAttribute("visibility"), "hidden");
    }
  });

  test("the size label reports the bounding box, not the traced mask", () => {
    const { svg, overlay } = makeOutline();

    overlay.draw({ x: 0, y: 0, width: 2, height: 2 }, [true, false, false, false]);

    const label = svg.querySelector("[data-overlay='selection-size']");
    assert.strictEqual(label?.getAttribute("visibility"), "visible");
    assert.strictEqual(label?.textContent, "2×2");
  });

  test("the size label hides a selection narrower than 2 on either axis", () => {
    const { svg, overlay } = makeOutline();

    for (const rect of [
      { width: 1, height: 1 },
      { width: 1, height: 8 },
      { width: 8, height: 1 }
    ]) {
      overlay.draw({ x: 0, y: 0, width: 8, height: 8 });
      overlay.draw({ x: 0, y: 0, ...rect });

      assert.strictEqual(
        svg.querySelector("[data-overlay='selection-size']")
          ?.getAttribute("visibility"),
        "hidden",
        `${rect.width}x${rect.height} is too small to label`
      );
    }
  });
});
