// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import {
  makeSvg,
  makeViewport
} from "../../helpers/overlay.ts";
import { makeUvMap } from "../../helpers/uv/map.ts";
import {
  uvBorderRects,
  uvEntryGroups
} from "../../helpers/uv/borders.ts";

describe("UVRegionLayer — free regions", () => {
  test("renders one rect per face", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({ width: 4, height: 4, id: "r1" });
    map.setState(region.id, "free");
    map.select("r1");

    assert.strictEqual(
      uvBorderRects(svg).length,
      6,
      "all six faces must be visible, or a stack cannot be dragged apart"
    );
  });

  test("paints the selected face last, above the rects it coincides with", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");

    assert.strictEqual(
      uvBorderRects(svg).at(-1)!.style.strokeWidth,
      "3",
      "selected face border should be thicker"
    );
    assert.deepStrictEqual(
      uvEntryGroups(svg).slice(0, -1).map((group) => group.style.opacity),
      Array.from({ length: 5 }, () => "0.45"),
      "unselected faces are dimmed"
    );
  });

  test("a stacked region keeps its plain full-opacity border", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4
    });
    map.select(region.id);

    const [rect] = uvBorderRects(svg);
    assert.strictEqual(rect.style.strokeWidth, "2");
    assert.strictEqual(uvEntryGroups(svg)[0].style.opacity, "");
  });

  test("setLivePreview moves only the dragged face", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });
    const overlay = new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1");

    overlay.setLivePreview(
      map.previewMove(
        "r1",
        { x: 9, y: 9, width: 4, height: 4 },
        "top"
      )
    );

    const moved = uvBorderRects(svg)
      .filter((rect) => rect.getAttribute("x") === "36");
    assert.strictEqual(
      moved.length,
      1,
      "only the dragged face follows the pointer"
    );
  });
});

describe("UVRegionLayer — compound faces", () => {
  test("outlines the union of the parts as one continuous subpath", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    map.restore(
      new UVRegion({
        id: "stair",
        color: "#123456",
        state: "free",
        activeFaces: ["left"],
        faces: {
          left: {
            shape: "compound",
            rect: { x: 0, y: 0, width: 4, height: 4 },
            parts: [
              { x: 0, y: 0.5, width: 1, height: 0.5 },
              { x: 0.5, y: 0, width: 0.5, height: 0.5 }
            ]
          }
        }
      })
    );
    map.select("stair", "left");

    const paths = [...svg.querySelectorAll<SVGPathElement>("g > path:last-child")];
    assert.strictEqual(paths.length, 1);

    const d = paths[0].getAttribute("d") ?? "";
    assert.strictEqual(
      d.split("M").length - 1,
      1,
      "the two parts share one subpath, so no edge is drawn inside the L"
    );
    assert.strictEqual(d, "M0,8L8,8L8,0L16,0L16,16L0,16Z");
  });
});

describe("UVRegionLayer — unfolded regions", () => {
  function makeUnfolded() {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });
    const overlay = new UVRegionLayer(svg, makeViewport(), map);

    map.create({ width: 4, height: 4, id: "r1" });
    map.setState("r1", "unfolded");
    map.select("r1");

    return { svg, map, overlay };
  }

  test("paints one border per face", () => {
    const { svg } = makeUnfolded();

    assert.strictEqual(uvBorderRects(svg).length, 6);
  });

  test("keeps every face at full opacity, unlike a free region", () => {
    const { svg } = makeUnfolded();

    assert.deepStrictEqual(
      uvEntryGroups(svg).map((group) => group.style.opacity),
      Array.from({ length: 6 }, () => "")
    );
  });

  test("emphasises the whole region, since no single face is selected", () => {
    const { svg } = makeUnfolded();

    assert.deepStrictEqual(
      uvBorderRects(svg).map((rect) => rect.style.strokeWidth),
      Array.from({ length: 6 }, () => "3")
    );
  });

  test("a previewed move of the net moves every face together", () => {
    const { svg, map, overlay } = makeUnfolded();

    overlay.setLivePreview(
      map.previewMove("r1", { x: 2, y: 3, width: 8, height: 12 })
    );

    assert.deepStrictEqual(
      uvBorderRects(svg).map((rect) => rect.getAttribute("x")),
      ["8", "24", "8", "24", "8", "24"]
    );
    assert.deepStrictEqual(
      uvBorderRects(svg).map((rect) => rect.getAttribute("y")),
      ["12", "12", "28", "28", "44", "44"]
    );
  });

  test("a suppressed region ghost hides all of its faces", () => {
    const { svg, overlay } = makeUnfolded();

    overlay.setGhostSuppressed([{ id: "r1", face: null }]);

    assert.strictEqual(uvBorderRects(svg).length, 0);
  });
});
