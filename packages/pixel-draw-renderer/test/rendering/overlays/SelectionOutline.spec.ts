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
  traceSelectionContour
} from "#src/rendering/overlays/selectionContour.ts";
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

    // zoom 4, camera (0,0): rect (1,1,2,3) -> x=4, y=4, width=8, height=12
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
      }, new Array(6).fill(true));

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

    test("a partial mask renders a visible path pair instead of the rect pair", () => {
      const svg = makeSvg();
      const overlay = new SelectionOutline(
        svg,
        makeViewport(),
        makeBrush()
      );

      // 2x2 mask, only the top-left cell selected.
      overlay.drawMask({
        x: 0,
        y: 0,
        width: 2,
        height: 2
      }, [true, false, false, false]);

      const rects = svg.querySelectorAll("rect");
      for (const rect of rects) {
        assert.strictEqual(rect.getAttribute("visibility"), "hidden");
      }
      const paths = svg.querySelectorAll("path");
      assert.strictEqual(paths.length, 2);
      for (const path of paths) {
        assert.strictEqual(path.getAttribute("visibility"), "visible");
        assert.ok(path.getAttribute("d"), "path has geometry");
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
    test("drawRect() shows the selection size", () => {
      const svg = makeSvg();
      const overlay = new SelectionOutline(
        svg,
        makeViewport(),
        makeBrush()
      );

      overlay.drawRect({
        x: 0,
        y: 0,
        width: 16,
        height: 16
      });

      const label = svg.querySelector("[data-overlay='selection-size']")!;
      assert.strictEqual(label.getAttribute("visibility"), "visible");
      assert.strictEqual(label.textContent, "16×16");
    });

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

    test("clear() hides the size label", () => {
      const svg = makeSvg();
      const overlay = new SelectionOutline(
        svg,
        makeViewport(),
        makeBrush()
      );

      overlay.drawRect({
        x: 0,
        y: 0,
        width: 4,
        height: 4
      });
      overlay.clear();

      const label = svg.querySelector("[data-overlay='selection-size']")!;
      assert.strictEqual(label.getAttribute("visibility"), "hidden");
    });

    test("sizeLabel: false creates no label at all", () => {
      const svg = makeSvg();
      const overlay = new SelectionOutline(
        svg,
        makeViewport(),
        makeBrush(),
        { sizeLabel: false }
      );

      overlay.drawRect({
        x: 0,
        y: 0,
        width: 4,
        height: 4
      });

      assert.strictEqual(
        svg.querySelector("[data-overlay='selection-size']"),
        null
      );
    });
  });

  describe("traceSelectionContour", () => {
    test("a full rectangle mask traces its 4 corners, clockwise", () => {
      const loops = traceSelectionContour(
        2,
        2,
        [true, true, true, true]
      );

      assert.strictEqual(loops.length, 1);
      assert.deepStrictEqual(
        loops[0],
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 2 },
          { x: 0, y: 2 }
        ]
      );
    });

    test("a single selected cell traces a unit square", () => {
      const loops = traceSelectionContour(
        1,
        1,
        [true]
      );

      assert.strictEqual(loops.length, 1);
      assert.deepStrictEqual(
        loops[0],
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      );
    });

    test("an L-shape traces its true concave outline (6 corners), not the bounding rect's 4", () => {
      // X .
      // X X
      const loops = traceSelectionContour(
        2,
        2,
        [true, false, true, true]
      );

      assert.strictEqual(loops.length, 1);
      assert.strictEqual(loops[0].length, 6);
    });

    test("a mask with a fully enclosed hole traces two loops (outer + inner)", () => {
      // 3x3 ring: every cell selected except the center.
      const mask = [
        true, true, true,
        true, false, true,
        true, true, true
      ];
      const loops = traceSelectionContour(3, 3, mask);

      assert.strictEqual(
        loops.length,
        2,
        "outer boundary + inner hole boundary"
      );
    });

    // Corner-touching cells share a boundary vertex, so that vertex starts
    // two edges. Keying edges by origin alone dropped one and the walk then
    // dereferenced a consumed edge (TypeError), which silently aborted
    // SelectEngine.importSelection halfway through a paste.
    test("two cells touching only at a corner trace as two separate loops", () => {
      // X .
      // . X
      const loops = traceSelectionContour(
        2,
        2,
        [true, false, false, true]
      );

      assert.strictEqual(loops.length, 2);
      assert.deepStrictEqual(
        loops.map((loop) => loop.length),
        [4, 4],
        "each cell keeps its own unit square"
      );
    });

    test("the anti-diagonal traces as two separate loops", () => {
      // . X
      // X .
      const loops = traceSelectionContour(
        2,
        2,
        [false, true, true, false]
      );

      assert.strictEqual(loops.length, 2);
    });

    test("a checkerboard traces one loop per cell", () => {
      const mask = [
        true, false, true,
        false, true, false,
        true, false, true
      ];
      const loops = traceSelectionContour(3, 3, mask);

      assert.strictEqual(loops.length, 5);
      assert.deepStrictEqual(
        loops.map((loop) => loop.length),
        [4, 4, 4, 4, 4]
      );
    });

    test("a corner-touching pair joined by a third cell stays one loop", () => {
      // X X
      // . X
      const loops = traceSelectionContour(
        2,
        2,
        [true, true, false, true]
      );

      assert.strictEqual(loops.length, 1);
      assert.strictEqual(loops[0].length, 6);
    });

    test("an empty mask traces nothing", () => {
      assert.deepStrictEqual(
        traceSelectionContour(2, 2, [false, false, false, false]),
        []
      );
    });
  });
});
