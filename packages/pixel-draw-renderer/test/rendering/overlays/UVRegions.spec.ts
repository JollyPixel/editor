// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import { UVRegion } from "#src/uv/UVRegion.ts";
import {
  makeSvg,
  makeViewport,
  makeUvMap
} from "../../helpers/overlay.ts";

// Every entry renders a <g> holding the casing stroke and, over it, the
// region-colored one.
function borders(
  svg: SVGElement
): SVGRectElement[] {
  return [...svg.querySelectorAll<SVGRectElement>("g > rect:last-child")];
}

function casings(
  svg: SVGElement
): SVGRectElement[] {
  return [...svg.querySelectorAll<SVGRectElement>("g > rect:first-child")];
}

function groups(
  svg: SVGElement
): SVGGElement[] {
  return [...svg.querySelectorAll<SVGGElement>(":scope > g[data-overlay=\"uv\"] > g")];
}

describe("UVRegionLayer — visibility follows UVMap state", () => {
  test("renders nothing for a region that isn't selected or shown", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    map.create({ width: 4, height: 4 });

    assert.strictEqual(
      borders(svg).length,
      0,
      "no rects when map is not selected or shown"
    );
  });

  test("renders a solid border rect once its region is selected", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 2,
      height: 3,
      id: "r1",
      color: "#123456"
    });
    map.select(region.id);

    const rects = borders(svg);
    assert.strictEqual(rects.length, 1);
    // zoom 4, camera (0,0): rect (0,0,2,3) -> x=0, y=0, width=8, height=12
    assert.strictEqual(rects[0].getAttribute("x"), "0");
    assert.strictEqual(rects[0].getAttribute("y"), "0");
    assert.strictEqual(rects[0].getAttribute("width"), "8");
    assert.strictEqual(rects[0].getAttribute("height"), "12");
    assert.strictEqual(
      rects[0].getAttribute("stroke"),
      "#123456",
      "the stroke color matches the region color"
    );
    assert.ok(
      !rects[0].hasAttribute("stroke-dasharray"),
      "solid, not dashed"
    );
    assert.notStrictEqual(
      casings(svg)[0].style.display,
      "none",
      "the classical border keeps its contrasting casing"
    );
  });

  test("insets the casing so it never paints outside the border", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    // The first cascade position is (0, 0) — flush with the canvas edge,
    // where a straddling casing would paint its outer half onto the page and
    // read as an extra pixel of canvas.
    const region = map.create({ width: 2, height: 3, id: "r1" });
    map.select(region.id);

    const [casing] = casings(svg);
    // 2px border and 4px casing, both centered on their own rect: insetting
    // the casing by 1px aligns the two outer edges exactly.
    assert.strictEqual(casing.getAttribute("x"), "1");
    assert.strictEqual(casing.getAttribute("y"), "1");
    assert.strictEqual(casing.getAttribute("width"), "6");
    assert.strictEqual(casing.getAttribute("height"), "10");
  });

  test("never inverts the casing rect on a region a few screen pixels wide", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(1), map);

    const region = map.create({
      width: 1,
      height: 1,
      id: "r1"
    });
    map.select(region.id);

    const [casing] = casings(svg);
    assert.strictEqual(casing.getAttribute("width"), "0");
    assert.strictEqual(casing.getAttribute("height"), "0");
  });

  test("showAll renders every region regardless of selection", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    map.create({
      width: 2,
      height: 2
    });
    map.create({
      width: 2,
      height: 2
    });
    map.showAll = true;

    assert.strictEqual(
      borders(svg).length,
      2,
      "two rects when showAll is true"
    );
  });

  test("removes the rect once its region is deselected", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(
      svg,
      makeViewport(),
      map
    );

    const region = map.create({
      width: 2,
      height: 2
    });
    map.select(region.id);
    assert.strictEqual(
      borders(svg).length,
      1,
      "one rect when region is selected"
    );

    map.select(null);
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "no rect when region is deselected"
    );
  });

  test("removes the rect once its region is deleted", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 2,
      height: 2
    });
    map.showAll = true;
    assert.strictEqual(
      borders(svg).length,
      1,
      "one rect when showAll is true"
    );

    map.delete(region.id);
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "no rect when region is deleted"
    );
  });

  test("moving a visible region updates its screen position", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 2,
      height: 2
    });
    map.showAll = true;
    map.move(
      region.id,
      { x: 5, y: 5, width: 2, height: 2 }
    );

    const [rect] = borders(svg);
    assert.strictEqual(rect.getAttribute("x"), "20");
    assert.strictEqual(rect.getAttribute("y"), "20");
  });
});

describe("UVRegionLayer — setLiveOverride", () => {
  test("renders the override rect instead of the stored one", () => {
    const svg = makeSvg();
    const map = makeUvMap();
    const overlay = new UVRegionLayer(
      svg,
      makeViewport(),
      map
    );

    const region = map.create({
      width: 2,
      height: 2
    });
    map.showAll = true;

    overlay.setLiveOverride(
      region.id,
      null,
      {
        x: 9, y: 9, width: 2, height: 2
      }
    );

    const [rect] = borders(svg);
    assert.strictEqual(rect.getAttribute("x"), "36");
    assert.strictEqual(rect.getAttribute("y"), "36");

    overlay.setLiveOverride(region.id, null, null);
    assert.strictEqual(rect.getAttribute("x"), "0");
  });
});

describe("UVRegionLayer — uncollapsed regions", () => {
  test("renders one rect per face", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({ width: 4, height: 4, id: "r1" });
    map.uncollapse(region.id);
    map.select("r1");

    assert.strictEqual(
      borders(svg).length,
      6,
      "all six faces must be visible, or a stack cannot be dragged apart"
    );
  });

  test("paints the selected face last, above the rects it coincides with", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      id: "r1"
    });
    map.uncollapse(region.id);
    // "front" is first in UV_FACES, so raising it is a real reorder.
    map.select("r1", "front");

    assert.strictEqual(
      borders(svg).at(-1)!.style.strokeWidth,
      "3",
      "selected face border should be thicker"
    );
    assert.deepStrictEqual(
      groups(svg).slice(0, -1).map((group) => group.style.opacity),
      Array.from({ length: 5 }, () => "0.45"),
      "unselected faces are dimmed"
    );
  });

  test("a collapsed region keeps its plain full-opacity border", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4
    });
    map.select(region.id);

    const [rect] = borders(svg);
    assert.strictEqual(rect.style.strokeWidth, "2");
    assert.strictEqual(groups(svg)[0].style.opacity, "");
  });

  test("setLiveOverride moves only the dragged face", () => {
    const svg = makeSvg();
    const map = makeUvMap();
    const overlay = new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      id: "r1"
    });
    map.uncollapse(region.id);
    map.select("r1");

    overlay.setLiveOverride(
      "r1",
      "top",
      { x: 9, y: 9, width: 4, height: 4 }
    );

    const moved = borders(svg)
      .filter((rect) => rect.getAttribute("x") === "36");
    assert.strictEqual(
      moved.length,
      1,
      "only the dragged face follows the pointer"
    );
  });
});

describe("UVRegionLayer — staying visible over the artwork", () => {
  test("casings a light region color in black and a dark one in white", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    map.create({
      width: 2,
      height: 2,
      id: "light",
      color: "#ffe08a"
    });
    map.create({
      width: 2,
      height: 2,
      id: "dark",
      color: "#123456"
    });
    map.showAll = true;

    assert.deepStrictEqual(
      casings(svg).map((casing) => casing.getAttribute("stroke")),
      ["#000", "#fff"],
      "a casing matching the region color would hide with it"
    );
  });

  test("draws the casing wider than the border it sits under", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      id: "r1"
    });
    map.uncollapse(region.id);
    map.select("r1", "front");

    // Selected face: 3px border, everything else 2px — each casing shows 1px
    // on either side of its border.
    assert.deepStrictEqual(
      casings(svg).map(
        (casing) => casing.style.strokeWidth
      ).sort(),
      ["4", "4", "4", "4", "4", "5"]
    );
  });

  test("tints the selected entry, and only that one", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      id: "r1",
      color: "#123456"
    });
    map.uncollapse(region.id);
    map.select("r1", "front");

    // "front" is painted last, so it is the last border in document order.
    const painted = borders(svg);
    const selected = painted.at(-1)!;
    assert.strictEqual(selected.style.fill, "#123456");
    assert.strictEqual(
      selected.style.fillOpacity,
      "0.06",
      "the tint marks the entry without masking the texture under it"
    );

    assert.deepStrictEqual(
      painted.slice(0, -1).map((rect) => rect.style.fill),
      Array.from({ length: 5 }, () => "none"),
      "a tint on every face would stack into an opaque block"
    );
  });

  test("drops the tint once the entry is deselected", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      color: "#123456"
    });
    map.select(region.id);
    map.showAll = true;
    assert.strictEqual(borders(svg)[0].style.fill, "#123456");

    map.select(null);

    const [rect] = borders(svg);
    assert.strictEqual(rect.style.fill, "none");
    assert.strictEqual(rect.style.fillOpacity, "");
  });

  test("casings the face label in the same contrasting color", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 12,
      height: 12,
      id: "r1",
      color: "#123456"
    });
    map.uncollapse(region.id);
    map.select("r1", "front");

    const label = svg.querySelector("text")!;
    assert.strictEqual(label.getAttribute("fill"), "#123456");
    assert.strictEqual(label.getAttribute("stroke"), "#fff");
    assert.strictEqual(
      label.getAttribute("paint-order"),
      "stroke",
      "without it the casing would cover the glyphs"
    );
  });
});
describe("UVRegionLayer — destroy", () => {
  test("stops reacting to UVMap events and removes its rects", () => {
    const svg = makeSvg();
    const map = makeUvMap();
    const overlay = new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 2,
      height: 2
    });
    map.showAll = true;
    assert.strictEqual(
      borders(svg).length,
      1,
      "one rect when showAll is true"
    );

    overlay.destroy();
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "no rect after destroy"
    );

    map.move(
      region.id,
      { x: 1, y: 1, width: 2, height: 2 }
    );
    assert.strictEqual(
      svg.querySelectorAll("rect").length,
      0,
      "no rect after move"
    );
  });
});

describe("UVRegionLayer — compound faces", () => {
  test("outlines the union of the parts as one continuous subpath", () => {
    const svg = makeSvg();
    const map = makeUvMap();

    new UVRegionLayer(svg, makeViewport(), map);

    map.restore(
      new UVRegion({
        id: "stair",
        color: "#123456",
        state: "uncollapsed",
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
    // zoom 4, camera (0,0): the region spans 16 screen pixels.
    assert.strictEqual(d, "M0,8L8,8L8,0L16,0L16,16L0,16Z");
  });
});
