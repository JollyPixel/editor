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

function makeGhosts(): {
  svg: SVGElement;
  viewport: ReturnType<typeof makeViewport>;
  ghosts: PeerSelectionOutlines;
} {
  const svg = makeSvg();
  const viewport = makeViewport();

  return { svg, viewport, ghosts: new PeerSelectionOutlines(svg, viewport) };
}

function paths(
  svg: SVGElement
): SVGPathElement[] {
  return [...svg.querySelectorAll("path")];
}

describe("PeerSelectionOutlines — set", () => {
  test("renders one dashed path around a plain selection, projected to the screen", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", kRectGhost);

    const [path] = paths(svg);
    assert.strictEqual(paths(svg).length, 1);
    assert.strictEqual(path.getAttribute("d"), "M 8 12 L 28 12 L 28 36 L 8 36 Z");
    assert.strictEqual(path.getAttribute("stroke"), "#ff0000");
    assert.ok(path.getAttribute("stroke-dasharray"));
  });

  test("traces the contour of a masked selection", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", kLShapeGhost);

    assert.strictEqual(paths(svg)[0].getAttribute("d"), "M 0 0 L 8 0 L 8 4 L 4 4 L 4 8 L 0 8 Z");
    assert.strictEqual(paths(svg)[0].getAttribute("stroke"), "#00ff00");
  });

  test("a later set() for the same peer reuses its path", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-A", { ...kRectGhost, rect: { x: 0, y: 0, width: 1, height: 1 } });

    assert.strictEqual(paths(svg).length, 1);
  });
});

describe("PeerSelectionOutlines — removal", () => {
  test("remove() and clearAll() drop the peers' paths", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-B", kLShapeGhost);
    ghosts.remove("peer-A");
    assert.strictEqual(paths(svg).length, 1);

    ghosts.clearAll();
    assert.strictEqual(paths(svg).length, 0);
  });

  test("removeOverlapping() drops a ghost sharing a pixel with the positions", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", kRectGhost);
    ghosts.removeOverlapping([{ x: 100, y: 100 }]);
    assert.strictEqual(paths(svg).length, 1);

    ghosts.removeOverlapping([{ x: 2, y: 3 }]);
    assert.strictEqual(paths(svg).length, 0);
  });

  test("removeOverlapping() respects the mask", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", kLShapeGhost);
    ghosts.removeOverlapping([kLShapeUnselectedCell]);

    assert.strictEqual(paths(svg).length, 1);
  });
});

describe("PeerSelectionOutlines — refresh", () => {
  test("re-projects the stored rect against a changed camera", () => {
    const { svg, viewport, ghosts } = makeGhosts();

    ghosts.set("peer-A", kRectGhost);
    viewport.camera.x = 5;
    viewport.camera.y = -2;
    ghosts.refresh();

    assert.ok(paths(svg)[0].getAttribute("d")?.startsWith("M 13 10 "));
  });
});
