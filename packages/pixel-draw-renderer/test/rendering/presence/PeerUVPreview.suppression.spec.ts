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
import { stackedGhost } from "../../helpers/presence/uvPreview.ts";

describe("PeerUVPreview — suppresses the classical UVRegionLayer border", () => {
  test(
    "hides the region's classical border while a peer's ghost for it is active, restores it once cleared",
    () => {
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
      assert.strictEqual(
        svg.querySelectorAll("rect").length,
        2,
        "classical border present before any ghost"
      );

      ghosts.set(
        "peer-A",
        stackedGhost(region.id, { x: 2, y: 3, width: 5, height: 6 })
      );
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
      stackedGhost("region-B", { x: 2, y: 3, width: 5, height: 6 })
    );

    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      4,
      "region-A's classical border + peer-B's ghost border"
    );
  });
});
