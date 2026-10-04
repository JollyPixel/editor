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

describe("SelectionOutline", () => {
  test("drawRect() shows a dashed outline+inline rect pair in screen space", () => {
    const svg = makeSvg();
    const overlay = new SelectionOutline(
      svg,
      makeViewport(),
      makeBrush()
    );

    overlay.drawRect({
      x: 1,
      y: 1,
      width: 2,
      height: 3
    });

    const rects = svg.querySelectorAll("rect");
    assert.strictEqual(
      rects.length,
      2,
      "one outline rect + one inline rect"
    );
    for (const rect of rects) {
      assert.strictEqual(rect.getAttribute("visibility"), "visible");
      assert.strictEqual(rect.getAttribute("x"), "4");
      assert.strictEqual(rect.getAttribute("y"), "4");
      assert.strictEqual(rect.getAttribute("width"), "8");
      assert.strictEqual(rect.getAttribute("height"), "12");
      assert.ok(
        rect.getAttribute("stroke-dasharray"),
        "should be dashed"
      );
    }
  });

  test("clear() hides the selection rect", () => {
    const svg = makeSvg();
    const overlay = new SelectionOutline(
      svg,
      makeViewport(),
      makeBrush()
    );

    overlay.drawRect({
      x: 0,
      y: 0,
      width: 1,
      height: 1
    });
    overlay.clear();

    const rects = svg.querySelectorAll("rect");
    for (const rect of rects) {
      assert.strictEqual(
        rect.getAttribute("visibility"),
        "hidden"
      );
    }
  });

  describe("drawMask", () => {
    test("a full-true mask degenerates to the same rendering as drawRect", () => {
      const svg = makeSvg();
      const overlay = new SelectionOutline(
        svg,
        makeViewport(),
        makeBrush()
      );

      overlay.drawMask({
        x: 1,
        y: 1,
        width: 2,
        height: 3
      }, Array.from({ length: 6 }, () => true));

      const rects = svg.querySelectorAll("rect");
      assert.strictEqual(rects.length, 2);
      for (const rect of rects) {
        assert.strictEqual(
          rect.getAttribute("visibility"),
          "visible",
          "visible rects"
        );
      }
      const paths = svg.querySelectorAll("path");
      for (const path of paths) {
        assert.strictEqual(
          path.getAttribute("visibility"),
          "hidden",
          "hidden paths"
        );
      }
    });

    test("a partial mask renders a visible path pair tracing the mask in screen space", () => {
      const svg = makeSvg();
      const viewport = makeViewport();
      viewport.camera = {
        x: 3,
        y: -5
      };
      const overlay = new SelectionOutline(
        svg,
        viewport,
        makeBrush()
      );

      overlay.drawMask({
        x: 1,
        y: 2,
        width: 2,
        height: 2
      }, [
        true, false,
        false, false
      ]);

      const rects = svg.querySelectorAll("rect");
      for (const rect of rects) {
        assert.strictEqual(rect.getAttribute("visibility"), "hidden");
      }
      const paths = svg.querySelectorAll("path");
      assert.strictEqual(paths.length, 2);
      for (const path of paths) {
        assert.strictEqual(path.getAttribute("visibility"), "visible");
        assert.strictEqual(
          path.getAttribute("d"),
          "M 7 3 L 11 3 L 11 7 L 7 7 Z"
        );
      }
    });

    test("clear() also hides the path pair", () => {
      const svg = makeSvg();
      const overlay = new SelectionOutline(
        svg,
        makeViewport(),
        makeBrush()
      );

      overlay.drawMask({
        x: 0,
        y: 0,
        width: 2,
        height: 2
      }, [true, false, false, false]);
      overlay.clear();

      for (const path of svg.querySelectorAll("path")) {
        assert.strictEqual(path.getAttribute("visibility"), "hidden");
      }
    });
  });

  describe("size label", () => {
    test("drawMask() reports the bounding box, not the traced mask", () => {
      const svg = makeSvg();
      const overlay = new SelectionOutline(
        svg,
        makeViewport(),
        makeBrush()
      );

      overlay.drawMask({
        x: 0,
        y: 0,
        width: 2,
        height: 2
      }, [true, false, false, false]);

      const label = svg.querySelector("[data-overlay='selection-size']")!;
      assert.strictEqual(label.getAttribute("visibility"), "visible");
      assert.strictEqual(label.textContent, "2×2");
    });
  });
});
