// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerUVPreview } from "#src/rendering/presence/PeerUVPreview.ts";
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import {
  makeSvg,
  makeUvOverlay,
  makeViewport
} from "../../helpers/overlay.ts";
import {
  COMPOUND_GHOST,
  RECT_GHOST,
  TRIANGLE_GHOST,
  freeGhost,
  stackedGhost
} from "../../helpers/presence/uvPreview.ts";

describe("PeerUVPreview — set", () => {
  test("renders a dashed rect border at the projected screen position, with no contrasting casing", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", RECT_GHOST);

    const rects = svg.querySelectorAll("rect");
    assert.strictEqual(
      rects.length,
      2,
      "casing element still exists in the DOM, just hidden"
    );
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

      ghosts.set("peer-A", RECT_GHOST);
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

    ghosts.set("peer-A", RECT_GHOST);
    ghosts.set("peer-A", TRIANGLE_GHOST);

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

    ghosts.set("peer-A", TRIANGLE_GHOST);
    ghosts.set("peer-A", COMPOUND_GHOST);

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
      id: RECT_GHOST.region.id,
      color: "#ff0000",
      state: "unfolded",
      faces: {
        front: { x: 0, y: 0, width: 2, height: 2 },
        back: { x: 2, y: 0, width: 3, height: 2 },
        top: { x: 0, y: 2, width: 2, height: 2 }
      }
    });

    ghosts.set("peer-A", { ...RECT_GHOST, region });

    const strokes = [...svg.querySelectorAll("rect")].filter((_rect, index) => index % 2 === 1);
    assert.deepStrictEqual(
      strokes.map((rect) => rect.getAttribute("width")),
      ["8", "12", "8"]
    );

    ghosts.set("peer-A", RECT_GHOST);
    assert.strictEqual(svg.querySelectorAll("rect").length, 2);
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

    ghosts.set("peer-A", RECT_GHOST);
    viewport.camera.x = 5;
    viewport.camera.y = -2;
    ghosts.refresh();

    const rects = svg.querySelectorAll("rect");
    assert.strictEqual(rects[1].getAttribute("x"), "13");
    assert.strictEqual(rects[1].getAttribute("y"), "10");
  });
});
