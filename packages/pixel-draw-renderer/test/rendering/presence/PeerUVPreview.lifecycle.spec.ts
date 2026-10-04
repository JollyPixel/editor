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
import {
  RECT_GHOST,
  TRIANGLE_GHOST,
  stackedGhost
} from "../../helpers/presence/uvPreview.ts";

describe("PeerUVPreview — remove", () => {
  test("removes the peer's border from the svg", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const ghosts = new PeerUVPreview(
      svg,
      viewport,
      makeUvOverlay(svg, viewport)
    );

    ghosts.set("peer-A", RECT_GHOST);
    ghosts.remove("peer-A");

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "old rect elements removed"
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

    ghosts.set("peer-A", RECT_GHOST);
    ghosts.removeByRegion(RECT_GHOST.region.id);

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

    ghosts.set("peer-A", RECT_GHOST);
    ghosts.set("peer-B", TRIANGLE_GHOST);
    ghosts.removeByRegion(RECT_GHOST.region.id);

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

    ghosts.set("peer-A", RECT_GHOST);
    ghosts.removeByRegion("unknown-region");
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      2,
      "unaffected"
    );
  });
});

describe("PeerUVPreview — clearAll", () => {
  test("removes every peer's border and restores the suppressed classical border", () => {
    const svg = makeSvg();
    const viewport = makeViewport();
    const uvMap = makeUvMap({ x: 64, y: 64 });
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
      stackedGhost(region.id, { x: 2, y: 3, width: 5, height: 6 })
    );
    ghosts.set("peer-B", TRIANGLE_GHOST);
    ghosts.clearAll();

    assert.strictEqual(svg.querySelectorAll("polygon").length, 0);
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
  });
});
