// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerUVPreview } from "#src/rendering/presence/PeerUVPreview.ts";
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import type { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import {
  makeSvg,
  makeUvOverlay,
  makeViewport
} from "../../helpers/overlay.ts";
import {
  uvBorderRects,
  uvCasingRects
} from "../../helpers/uv/borders.ts";
import {
  COMPOUND_GHOST,
  RECT_GHOST,
  TRIANGLE_GHOST,
  freeGhost,
  stackedGhost
} from "../../helpers/presence/uvPreview.ts";

function makeGhosts(): {
  svg: SVGElement;
  viewport: ReturnType<typeof makeViewport>;
  overlay: UVRegionLayer;
  ghosts: PeerUVPreview;
} {
  const svg = makeSvg();
  const viewport = makeViewport();
  const overlay = makeUvOverlay(svg, viewport);

  return { svg, viewport, overlay, ghosts: new PeerUVPreview(overlay) };
}

describe("PeerUVPreview — set", () => {
  test("renders a dashed border at the projected screen position, with no contrasting casing", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", RECT_GHOST);

    const [border] = uvBorderRects(svg);
    assert.strictEqual(uvBorderRects(svg).length, 1);
    assert.strictEqual(border.getAttribute("x"), "8");
    assert.strictEqual(border.getAttribute("y"), "12");
    assert.strictEqual(border.getAttribute("width"), "20");
    assert.strictEqual(border.getAttribute("height"), "24");
    assert.strictEqual(border.getAttribute("stroke"), "#ff0000");
    assert.ok(border.getAttribute("stroke-dasharray"));
    assert.strictEqual(uvCasingRects(svg)[0].style.display, "none");
  });

  test("a later set() for the same peer replaces its ghost instead of adding one", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", RECT_GHOST);
    ghosts.set("peer-A", stackedGhost("region-A", { x: 0, y: 0, width: 1, height: 1 }));

    assert.strictEqual(uvBorderRects(svg).length, 1);
    assert.strictEqual(uvBorderRects(svg)[0].getAttribute("width"), "4");
  });

  test("draws triangle and compound faces as paths", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", TRIANGLE_GHOST);
    ghosts.set("peer-B", COMPOUND_GHOST);

    assert.strictEqual(uvBorderRects(svg).length, 2);
    assert.deepStrictEqual(
      uvBorderRects(svg).map((border) => border.getAttribute("width")),
      ["16", "16"]
    );
  });

  test("draws only the dragged face of a free region", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", freeGhost("region-D", { x: 1, y: 1, width: 3, height: 3 }, "#ff0000"));

    assert.strictEqual(uvBorderRects(svg).length, 1);
    assert.strictEqual(uvBorderRects(svg)[0].getAttribute("width"), "12");
  });

  test("draws every face of an unfolded region, then one border for a stacked one", () => {
    const { svg, ghosts } = makeGhosts();
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
    assert.deepStrictEqual(
      uvBorderRects(svg).map((border) => border.getAttribute("width")),
      ["8", "12", "8"]
    );

    ghosts.set("peer-A", RECT_GHOST);
    assert.strictEqual(uvBorderRects(svg).length, 1);
  });

  test("re-projects against a changed camera when the overlay refreshes", () => {
    const { svg, viewport, overlay, ghosts } = makeGhosts();

    ghosts.set("peer-A", RECT_GHOST);
    viewport.camera.x = 5;
    viewport.camera.y = -2;
    overlay.refresh();

    assert.strictEqual(uvBorderRects(svg)[0].getAttribute("x"), "13");
    assert.strictEqual(uvBorderRects(svg)[0].getAttribute("y"), "10");
  });
});
