// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerSelectionGhosts,
  type PeerSelectionGhostState
} from "#src/rendering/overlays/PeerSelectionGhosts.ts";
import {
  makeSvg,
  makeViewport
} from "../../helpers/overlay.ts";

// CONSTANTS
const kRectGhost: PeerSelectionGhostState = {
  rect: {
    x: 2,
    y: 3,
    width: 5,
    height: 6
  },
  mask: null,
  color: "#ff0000"
};
// An L-shape: top row fully selected, bottom row only the left cell.
const kMaskedGhost: PeerSelectionGhostState = {
  rect: {
    x: 0,
    y: 0,
    width: 2,
    height: 2
  },
  mask: [true, true, true, false],
  color: "#00ff00"
};

describe("PeerSelectionGhosts — set", () => {
  test("renders a dashed rect border at the projected screen position for a plain (unmasked) selection", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    ghosts.set("peer-A", kRectGhost);

    const rects = svg.querySelectorAll("rect");
    assert.strictEqual(rects.length, 1);
    // zoom 4, camera (0,0): x=2*4=8, y=3*4=12, width=5*4=20, height=6*4=24
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
  });

  test("a mask that is entirely true renders as the plain rect fast path", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    ghosts.set(
      "peer-A",
      { ...kRectGhost, mask: [true, true, true, true] }
    );

    assert.strictEqual(svg.querySelectorAll("rect").length, 1);
    assert.strictEqual(
      svg.querySelector("path")?.getAttribute("visibility"),
      "hidden"
    );
  });

  test("renders a traced contour path for a masked (shaped) selection", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    ghosts.set("peer-A", kMaskedGhost);

    const paths = svg.querySelectorAll("path");
    assert.strictEqual(paths.length, 1);
    assert.ok(paths[0].getAttribute("d"));
    assert.strictEqual(
      paths[0].getAttribute("stroke"),
      "#00ff00"
    );
    assert.ok(paths[0].getAttribute("stroke-dasharray"));
  });

  test("tracks multiple peers independently", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-B", { ...kRectGhost, color: "#0000ff" });

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      2
    );
  });

  test("a later set() for the same peer reuses its border elements (no duplicates)", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

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

describe("PeerSelectionGhosts — remove", () => {
  test("removes the peer's border from the svg", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

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

  test("removing an unknown peer is a no-op", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    assert.doesNotThrow(() => ghosts.remove("nobody"));
  });
});

describe("PeerSelectionGhosts — removeOverlapping", () => {
  test("clears a peer's ghost sharing a pixel with the given positions", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

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
    const ghosts = new PeerSelectionGhosts(svg, viewport);

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
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    // (1,1) is the mask's false cell (bottom-right of the L-shape).
    ghosts.set("peer-A", kMaskedGhost);
    ghosts.removeOverlapping([{ x: 1, y: 1 }]);

    assert.strictEqual(
      svg.querySelectorAll("path").length,
      1,
      "unaffected"
    );
  });

  test("is a no-op for an empty positions array", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.removeOverlapping([]);

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      1
    );
  });
});

describe("PeerSelectionGhosts — clearAll", () => {
  test("removes every peer's border", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-B", kMaskedGhost);
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

describe("PeerSelectionGhosts — refresh", () => {
  test("re-projects the stored rect against a changed camera", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    viewport.camera.x = 5;
    viewport.camera.y = -2;
    ghosts.refresh();

    const rects = svg.querySelectorAll("rect");
    // x = 2*4 + 5 = 13, y = 3*4 - 2 = 10
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

describe("PeerSelectionGhosts — destroy", () => {
  test("removes every tracked peer's border", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerSelectionGhosts(svg, viewport);

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-B", kMaskedGhost);
    ghosts.destroy();

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
