// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerUVPreview,
  type PeerUVPreviewState
} from "#src/rendering/presence/PeerUVPreview.ts";
import {
  UVRegion,
  type UVGeometry
} from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";
import {
  makeSvg,
  makeUvMap,
  makeUvOverlay,
  makeViewport
} from "../../helpers/overlay.ts";

function stackedGhost(
  id: string,
  rect: SelectionRect
): PeerUVPreviewState {
  return {
    region: new UVRegion({
      id,
      color: "#ff0000",
      state: "stacked",
      rect
    }),
    face: null,
    color: "#ff0000"
  };
}

function freeGhost(
  id: string,
  front: UVGeometry,
  color: string
): PeerUVPreviewState {
  return {
    region: new UVRegion({
      id,
      color,
      state: "free",
      faces: {
        front,
        back: { x: 20, y: 20, width: 2, height: 2 }
      }
    }),
    face: "front",
    color
  };
}

// CONSTANTS
const kRectGhost = stackedGhost("region-A", {
  x: 2,
  y: 3,
  width: 5,
  height: 6
});
const kTriangleGhost = freeGhost(
  "region-B",
  {
    shape: "triangle",
    rect: {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    },
    corner: "top-left"
  },
  "#00ff00"
);
const kCompoundGhost = freeGhost(
  "region-C",
  {
    shape: "compound",
    rect: {
      x: 1,
      y: 2,
      width: 4,
      height: 4
    },
    parts: [
      {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      }
    ]
  },
  "#0000ff"
);

describe("PeerUVPreview — set", () => {
  test("renders a dashed rect border at the projected screen position, with no contrasting casing", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);

    const rects = svg.querySelectorAll("rect");
    assert.strictEqual(
      rects.length,
      2,
      "casing element still exists in the DOM, just hidden"
    );
    // zoom 4, camera (0,0): x=2*4=8, y=3*4=12, width=5*4=20, height=6*4=24
    assert.strictEqual(rects[1].getAttribute("x"), "8");
    assert.strictEqual(rects[1].getAttribute("y"), "12");
    assert.strictEqual(rects[1].getAttribute("width"), "20");
    assert.strictEqual(rects[1].getAttribute("height"), "24");
    assert.strictEqual(
      rects[1].getAttribute("stroke"),
      "#ff0000",
      "the stroke color is red"
    );
    assert.ok(
      rects[1].getAttribute("stroke-dasharray"),
      "the stroke is dashed"
    );
    assert.strictEqual(
      rects[0].style.display,
      "none",
      "the black/white contrasting casing is hidden for a ghost"
    );
  });

  test("renders a polygon for a triangle face", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kTriangleGhost);

    assert.strictEqual(
      svg.querySelectorAll("polygon").length,
      2,
      "casing + stroke"
    );
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "no rect elements"
    );
  });

  test("tracks multiple peers independently", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    ghosts.set(
      "peer-B",
      { ...kRectGhost, color: "#0000ff" }
    );

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      4,
      "two rect elements for each peer"
    );
  });

  test(
    "a later set() for the same peer with the same shape family reuses the border (no duplicate elements)",
    () => {
      const svg = makeSvg();
      const viewport = makeViewport();
      const ghosts = new PeerUVPreview(
        svg,
        viewport,
        makeUvOverlay(svg, viewport)
      );

      ghosts.set("peer-A", kRectGhost);
      ghosts.set(
        "peer-A",
        stackedGhost("region-A", { x: 0, y: 0, width: 1, height: 1 })
      );

      assert.strictEqual(
        svg.querySelectorAll("rect").length,
        2,
        "two rect elements created"
      );
    }
  );

  test("switching shape family (rect -> triangle) for the same peer recreates the border", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-A", kTriangleGhost);

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "old rect elements removed"
    );
    assert.strictEqual(
      svg.querySelectorAll("polygon").length,
      2,
      "old polygon elements removed"
    );
  });

  test("switching from a triangle to a compound recreates the SVG geometry", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kTriangleGhost);
    ghosts.set("peer-A", kCompoundGhost);

    assert.strictEqual(svg.querySelectorAll("polygon").length, 0);
    assert.strictEqual(svg.querySelectorAll("path").length, 2);
  });

  test("draws only the dragged face of a free region", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", freeGhost(
      "region-D",
      { x: 1, y: 1, width: 3, height: 3 },
      "#ff0000"
    ));

    assert.strictEqual(svg.querySelectorAll("rect").length, 2);
    assert.strictEqual(svg.querySelectorAll("rect")[1].getAttribute("width"), "12");
  });

  test("draws every face of an unfolded region, then one border for a stacked one", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );
    const region = new UVRegion({
      id: kRectGhost.region.id,
      color: "#ff0000",
      state: "unfolded",
      faces: {
        front: { x: 0, y: 0, width: 2, height: 2 },
        back: { x: 2, y: 0, width: 3, height: 2 },
        top: { x: 0, y: 2, width: 2, height: 2 }
      }
    });

    ghosts.set("peer-A", { ...kRectGhost, region });

    const strokes = [...svg.querySelectorAll("rect")].filter((_rect, index) => index % 2 === 1);
    assert.deepStrictEqual(
      strokes.map((rect) => rect.getAttribute("width")),
      ["8", "12", "8"]
    );

    ghosts.set("peer-A", kRectGhost);
    assert.strictEqual(svg.querySelectorAll("rect").length, 2);
  });
});

describe("PeerUVPreview — remove", () => {
  test("removes the peer's border from the svg", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    ghosts.remove("peer-A");

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "old rect elements removed"
    );
  });

  test("removing an unknown peer is a no-op", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    assert.doesNotThrow(
      () => ghosts.remove("nobody"),
      "removing an unknown peer is a no-op"
    );
  });
});

describe("PeerUVPreview — removeByRegion", () => {
  test("clears whichever peer's ghost matches the region id, regardless of clientId", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    ghosts.removeByRegion(kRectGhost.region.id);

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "old rect elements removed"
    );
  });

  test("leaves other peers' ghosts for unrelated regions untouched", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-B", kTriangleGhost);
    ghosts.removeByRegion(kRectGhost.region.id);

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0
    );
    assert.strictEqual(
      svg.querySelectorAll("polygon").length,
      2,
      "peer-B's unrelated ghost remains"
    );
  });

  test("is a no-op for an unknown region id", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    assert.doesNotThrow(
      () => ghosts.removeByRegion("unknown-region")
    );
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      2,
      "unaffected"
    );
  });
});

describe("PeerUVPreview — clearAll", () => {
  test("removes every peer's border", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-B", kTriangleGhost);
    ghosts.clearAll();

    assert.strictEqual(svg.querySelectorAll("rect").length, 0);
    assert.strictEqual(svg.querySelectorAll("polygon").length, 0);
  });
});

describe("PeerUVPreview — refresh", () => {
  test("re-projects the stored geometry against a changed camera", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    viewport.camera.x = 5;
    viewport.camera.y = -2;
    ghosts.refresh();

    const rects = svg.querySelectorAll("rect");
    // x = 2*4 + 5 = 13, y = 3*4 - 2 = 10
    assert.strictEqual(rects[1].getAttribute("x"), "13");
    assert.strictEqual(rects[1].getAttribute("y"), "10");
  });
});

describe("PeerUVPreview — destroy", () => {
  test("removes every tracked peer's border", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", kRectGhost);
    ghosts.set("peer-B", kTriangleGhost);
    ghosts.destroy();

    assert.strictEqual(svg.querySelectorAll("rect").length, 0);
    assert.strictEqual(svg.querySelectorAll("polygon").length, 0);
  });
});

describe("PeerUVPreview — suppresses the classical UVRegionLayer border", () => {
  test(
    "hides the region's classical border while a peer's ghost for it is active, restores it once cleared",
    () => {
      const svg = makeSvg();
      const viewport = makeViewport();
      const uvMap = makeUvMap();
      const uvOverlay = makeUvOverlay(svg, viewport, uvMap);
      const ghosts = new PeerUVPreview(svg, viewport, uvOverlay);

      const region = uvMap.create({
        width: 2,
        height: 3,
        id: "region-A",
        color: "#123456"
      });
      uvMap.select(region.id);
      // classical border: casing + stroke, visible once selected.
      assert.strictEqual(
        svg.querySelectorAll("rect").length,
        2,
        "classical border present before any ghost"
      );

      ghosts.set(
        "peer-A",
        stackedGhost(region.id, { x: 2, y: 3, width: 5, height: 6 })
      );
      // classical border gone; only the (dashed) ghost border remains.
      const rectsWhileDragging = svg.querySelectorAll("rect");
      assert.strictEqual(
        rectsWhileDragging.length,
        2,
        "only the ghost border remains"
      );
      assert.ok(
        rectsWhileDragging[1].getAttribute("stroke-dasharray"),
        "the remaining border is the dashed ghost"
      );

      ghosts.remove("peer-A");
      const rectsAfterClear = svg.querySelectorAll("rect");
      assert.strictEqual(
        rectsAfterClear.length,
        2,
        "classical border restored"
      );
      assert.ok(
        !rectsAfterClear[1].hasAttribute("stroke-dasharray"),
        "the restored border is solid, not the ghost"
      );
    }
  );

  test("a ghost for an unrelated region doesn't suppress this region's classical border", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const uvMap = makeUvMap();
    const uvOverlay = makeUvOverlay(svg, viewport, uvMap);
    const ghosts = new PeerUVPreview(svg, viewport, uvOverlay);

    const region = uvMap.create({
      width: 2,
      height: 3,
      id: "region-A",
      color: "#123456"
    });
    uvMap.select(region.id);
    ghosts.set(
      "peer-A",
      stackedGhost("region-B", { x: 2, y: 3, width: 5, height: 6 })
    );

    // region-A's classical border (2) + peer-B's ghost border (2).
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      4,
      "region-A's classical border + peer-B's ghost border"
    );
  });
});
