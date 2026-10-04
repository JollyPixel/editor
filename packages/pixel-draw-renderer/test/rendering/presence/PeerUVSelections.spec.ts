// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerUVSelections } from "#src/rendering/presence/PeerUVSelections.ts";
import type { UVMap } from "#src/uv/map/UVMap.ts";
import {
  makeSvg,
  makeUvOverlay,
  makeViewport
} from "../../helpers/overlay.ts";
import { makeUvMap } from "../../helpers/uv/map.ts";

// CONSTANTS
const kRegionColor = "#123456";
const kPeerColor = "#ff00aa";
const kOtherPeerColor = "#00ffaa";

function setup(): {
  svg: SVGElement;
  map: UVMap;
  selections: PeerUVSelections;
} {
  const svg = makeSvg();
  const map = makeUvMap({ x: 64, y: 64 });
  const selections = new PeerUVSelections(
    makeUvOverlay(svg, makeViewport(), map)
  );
  map.showAll = true;
  for (const id of ["r1", "r2"]) {
    map.create({
      width: 4,
      height: 4,
      id,
      color: kRegionColor
    });
  }

  return {
    svg,
    map,
    selections
  };
}

function borders(
  svg: SVGElement
): SVGRectElement[] {
  return [...svg.querySelectorAll<SVGRectElement>("g > rect:last-child")];
}

function strokes(
  svg: SVGElement
): Array<string | null> {
  return borders(svg).map((rect) => rect.getAttribute("stroke"));
}

describe("PeerUVSelections", () => {
  test("outlines a peer's region in the peer color without the selected fill", () => {
    const { svg, selections } = setup();

    selections.set("peer-A", {
      regionId: "r1",
      color: kPeerColor
    });

    const peerBorder = borders(svg).at(-1)!;
    assert.deepStrictEqual(strokes(svg), [kRegionColor, kPeerColor]);
    assert.strictEqual(peerBorder.style.strokeWidth, "2");
    assert.strictEqual(peerBorder.style.fill, "none");
  });

  test("paints peer selections above plain regions and below the local one", () => {
    const { svg, map, selections } = setup();

    map.select("r1");
    selections.set("peer-A", {
      regionId: "r2",
      color: kPeerColor
    });

    assert.deepStrictEqual(strokes(svg), [kPeerColor, kRegionColor]);
    assert.strictEqual(borders(svg).at(-1)!.style.fill, kRegionColor);
  });

  test("keeps the local highlight when a peer selects the same region", () => {
    const { svg, map, selections } = setup();

    map.select("r1");
    selections.set("peer-A", {
      regionId: "r1",
      color: kPeerColor
    });

    assert.deepStrictEqual(strokes(svg), [kRegionColor, kRegionColor]);
    assert.strictEqual(borders(svg).at(-1)!.style.fill, kRegionColor);
  });

  test("shows the peer color again once the local selection moves away", () => {
    const { svg, map, selections } = setup();

    map.select("r1");
    selections.set("peer-A", {
      regionId: "r1",
      color: kPeerColor
    });
    map.select("r2");

    assert.deepStrictEqual(strokes(svg), [kPeerColor, kRegionColor]);
  });

  test("uses the first peer's color when several peers share a region", () => {
    const { svg, selections } = setup();

    selections.set("peer-A", {
      regionId: "r1",
      color: kPeerColor
    });
    selections.set("peer-B", {
      regionId: "r1",
      color: kOtherPeerColor
    });

    assert.deepStrictEqual(strokes(svg), [kRegionColor, kPeerColor]);

    selections.remove("peer-A");
    assert.deepStrictEqual(strokes(svg), [kRegionColor, kOtherPeerColor]);
  });

  test("does not dim the faces of a free region a peer selected", () => {
    const { svg, map, selections } = setup();

    map.setState("r1", "free");
    map.select("r2");
    selections.set("peer-A", {
      regionId: "r1",
      color: kPeerColor
    });

    const peerGroups = borders(svg)
      .filter((rect) => rect.getAttribute("stroke") === kPeerColor)
      .map((rect) => rect.parentElement!.style.opacity);
    assert.ok(peerGroups.length > 1);
    assert.ok(peerGroups.every((opacity) => opacity === ""));
  });

  test("restores the region color on remove, clearAll and destroy", () => {
    const { svg, selections } = setup();

    selections.set("peer-A", {
      regionId: "r1",
      color: kPeerColor
    });
    selections.remove("peer-A");
    assert.deepStrictEqual(strokes(svg), [kRegionColor, kRegionColor]);

    selections.set("peer-A", {
      regionId: "r1",
      color: kPeerColor
    });
    selections.clearAll();
    assert.deepStrictEqual(strokes(svg), [kRegionColor, kRegionColor]);

    selections.set("peer-B", {
      regionId: "r2",
      color: kPeerColor
    });
    selections.destroy();
    assert.deepStrictEqual(strokes(svg), [kRegionColor, kRegionColor]);
  });
});
