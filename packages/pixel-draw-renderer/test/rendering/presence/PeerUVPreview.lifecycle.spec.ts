// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerUVPreview } from "#src/rendering/presence/PeerUVPreview.ts";
import {
  makeSvg,
  makeUvOverlay,
  makeViewport
} from "../../helpers/overlay.ts";
import { makeUvMap } from "../../helpers/uv/map.ts";
import { uvBorderRects } from "../../helpers/uv/borders.ts";
import {
  RECT_GHOST,
  TRIANGLE_GHOST,
  stackedGhost
} from "../../helpers/presence/uvPreview.ts";

function makeGhosts(
  uvMap = makeUvMap({ x: 64, y: 64 })
): { svg: SVGElement; ghosts: PeerUVPreview; } {
  const svg = makeSvg();
  const overlay = makeUvOverlay(svg, makeViewport(), uvMap);

  return { svg, ghosts: new PeerUVPreview(overlay) };
}

describe("PeerUVPreview — lifecycle", () => {
  test("remove() drops the peer's ghost", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", RECT_GHOST);
    ghosts.remove("peer-A");

    assert.strictEqual(uvBorderRects(svg).length, 0);
  });

  test("removeByRegion() drops every ghost of that region and keeps the others", () => {
    const { svg, ghosts } = makeGhosts();

    ghosts.set("peer-A", RECT_GHOST);
    ghosts.set("peer-B", TRIANGLE_GHOST);
    ghosts.removeByRegion(RECT_GHOST.region.id);
    ghosts.removeByRegion("unknown-region");

    assert.strictEqual(uvBorderRects(svg).length, 1);
    assert.strictEqual(uvBorderRects(svg)[0].getAttribute("stroke"), "#00ff00");
  });

  test("clearAll() drops every ghost and restores the solid border it replaced", () => {
    const uvMap = makeUvMap({ x: 64, y: 64 });
    const { svg, ghosts } = makeGhosts(uvMap);
    const region = uvMap.create({ width: 2, height: 3, id: "region-A", color: "#123456" });
    uvMap.select(region.id);

    ghosts.set("peer-A", stackedGhost(region.id, { x: 2, y: 3, width: 5, height: 6 }));
    ghosts.set("peer-B", TRIANGLE_GHOST);
    ghosts.clearAll();

    const borders = uvBorderRects(svg);
    assert.strictEqual(borders.length, 1);
    assert.ok(!borders[0].hasAttribute("stroke-dasharray"));
  });
});

describe("PeerUVPreview — replaces the stored border", () => {
  test("hides the region's own border while a peer's ghost for it is active", () => {
    const uvMap = makeUvMap({ x: 64, y: 64 });
    const { svg, ghosts } = makeGhosts(uvMap);
    const region = uvMap.create({ width: 2, height: 3, id: "region-A", color: "#123456" });
    uvMap.select(region.id);

    ghosts.set("peer-A", stackedGhost(region.id, { x: 2, y: 3, width: 5, height: 6 }));
    assert.strictEqual(uvBorderRects(svg).length, 1);
    assert.ok(uvBorderRects(svg)[0].getAttribute("stroke-dasharray"));

    ghosts.remove("peer-A");
    assert.strictEqual(uvBorderRects(svg).length, 1);
    assert.ok(!uvBorderRects(svg)[0].hasAttribute("stroke-dasharray"));
  });

  test("a ghost for another region leaves this region's border alone", () => {
    const uvMap = makeUvMap({ x: 64, y: 64 });
    const { svg, ghosts } = makeGhosts(uvMap);
    const region = uvMap.create({ width: 2, height: 3, id: "region-A", color: "#123456" });
    uvMap.select(region.id);

    ghosts.set("peer-A", stackedGhost("region-B", { x: 2, y: 3, width: 5, height: 6 }));

    assert.strictEqual(uvBorderRects(svg).length, 2);
  });
});
