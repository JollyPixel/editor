// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerSelectionOutlines,
  type PeerSelectionOutlineState
} from "#src/rendering/presence/PeerSelectionOutlines.ts";
import {
  makeSvg,
  makeViewport
} from "../../helpers/overlay.ts";

// CONSTANTS
const kRectGhost: PeerSelectionOutlineState = {
  rect: {
    x: 2,
    y: 3,
    width: 5,
    height: 6
  },
  mask: null,
  color: "#ff0000"
};
const kLShapeGhost: PeerSelectionOutlineState = {
  rect: {
    x: 0,
    y: 0,
    width: 2,
    height: 2
  },
  mask: [true, true, true, false],
  color: "#00ff00"
};
const kLShapeUnselectedCell = { x: 1, y: 1 };

describe("PeerSelectionOutlines — set", () => {
  test(
    "renders a dashed rect border at the projected screen position for a plain (unmasked) selection",
    () => {
      const svg = makeSvg();
      const viewport = makeViewport();
      const ghosts = new PeerSelectionOutlines(svg, viewport);

      ghosts.set("peer-A", kRectGhost);

      const rects = svg.querySelectorAll("rect");
      assert.strictEqual(rects.length, 1);
      assert.strictEqual(rects[0].getAttribute("visibility"), "visible");
      assert.strictEqual(rects[0].getAttribute("x"), "8");
      assert.strictEqual(rects[0].getAttribute("y"), "12");
      assert.strictEqual(rects[0].getAttribute("width"), "20");
      assert.strictEqual(rects[0].getAttribute("height"), "24");
      assert.strictEqual(
        rects[0].getAttribute("stroke"),
        "#ff0000"
      );
      assert.ok(
        rects[0].getAttribute("stroke-dasharray"),
        "the stroke is dashed"
      );
      assert.strictEqual(
        svg.querySelector("path")?.getAttribute("visibility"),
        "hidden",
        "the path element still exists in the DOM, just hidden"
      );
    }
  );

  test("renders a traced contour path for a masked (shaped) selection", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionOutlines(svg, viewport);

    ghosts.set("peer-A", kLShapeGhost);

    const paths = svg.querySelectorAll("path");
    assert.strictEqual(paths.length, 1);
    assert.strictEqual(paths[0].getAttribute("visibility"), "visible");
    assert.strictEqual(
      paths[0].getAttribute("d"),
      "M 0 0 L 8 0 L 8 4 L 4 4 L 4 8 L 0 8 Z"
    );
    assert.strictEqual(
      paths[0].getAttribute("stroke"),
      "#00ff00"
    );
    assert.ok(paths[0].getAttribute("stroke-dasharray"));
    assert.strictEqual(
      svg.querySelector("rect")?.getAttribute("visibility"),
      "hidden"
    );
  });

  test("a later set() for the same peer reuses its border elements (no duplicates)", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionOutlines(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.set(
      "peer-A",
      { ...kRectGhost, rect: { x: 0, y: 0, width: 1, height: 1 } }
    );

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      1
    );
  });
});

describe("PeerSelectionOutlines — remove", () => {
  test("removes the peer's border from the svg", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionOutlines(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.remove("peer-A");

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0
    );
    assert.strictEqual(
      svg.querySelectorAll("path").length,
      0
    );
  });
});

describe("PeerSelectionOutlines — removeOverlapping", () => {
  test("clears a peer's ghost sharing a pixel with the given positions", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionOutlines(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.removeOverlapping([{ x: 2, y: 3 }]);

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0
    );
  });

  test("leaves a ghost untouched when positions don't overlap its rect", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionOutlines(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.removeOverlapping([{ x: 100, y: 100 }]);

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      1
    );
  });

  test("respects the mask — a position only in an unmasked cell doesn't overlap", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionOutlines(svg, viewport);

    ghosts.set("peer-A", kLShapeGhost);
    ghosts.removeOverlapping([kLShapeUnselectedCell]);

    assert.strictEqual(
      svg.querySelectorAll("path").length,
      1,
      "unaffected"
    );
  });
});

describe("PeerSelectionOutlines — clearAll", () => {
  test("tracks one border per peer and removes every one of them", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionOutlines(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-B", kLShapeGhost);
    assert.strictEqual(svg.querySelectorAll("rect").length, 2);
    assert.strictEqual(svg.querySelectorAll("path").length, 2);

    ghosts.clearAll();

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0
    );
    assert.strictEqual(
      svg.querySelectorAll("path").length,
      0
    );
  });
});

describe("PeerSelectionOutlines — refresh", () => {
  test("re-projects the stored rect against a changed camera", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionOutlines(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    viewport.camera.x = 5;
    viewport.camera.y = -2;
    ghosts.refresh();

    const rects = svg.querySelectorAll("rect");
    assert.strictEqual(
      rects[0].getAttribute("x"),
      "13"
    );
    assert.strictEqual(
      rects[0].getAttribute("y"),
      "10"
    );
  });
});
