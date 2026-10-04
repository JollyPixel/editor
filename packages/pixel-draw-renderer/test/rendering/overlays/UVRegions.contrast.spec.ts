// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import {
  makeSvg,
  makeViewport
} from "../../helpers/overlay.ts";
import { makeUvMap } from "../../helpers/uv/map.ts";
import {
  uvBorderRects,
  uvCasingRects
} from "../../helpers/uv/borders.ts";

describe("UVRegionLayer — staying visible over the artwork", () => {
  test("casings a light region color in black and a dark one in white", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

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
      uvCasingRects(svg).map((casing) => casing.getAttribute("stroke")),
      ["#000", "#fff"],
      "a casing matching the region color would hide with it"
    );
  });

  test("draws the casing wider than the border it sits under", () => {
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

    assert.deepStrictEqual(
      uvCasingRects(svg).map(
        (casing) => casing.style.strokeWidth
      ).sort(),
      ["4", "4", "4", "4", "4", "5"]
    );
  });

  test("tints the selected entry, and only that one", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      id: "r1",
      color: "#123456"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");

    const painted = uvBorderRects(svg);
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
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 4,
      height: 4,
      color: "#123456"
    });
    map.select(region.id);
    map.showAll = true;
    assert.strictEqual(uvBorderRects(svg)[0].style.fill, "#123456");

    map.select(null);

    const [rect] = uvBorderRects(svg);
    assert.strictEqual(rect.style.fill, "none");
    assert.strictEqual(rect.style.fillOpacity, "");
  });

  test("casings the face label in the same contrasting color", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 12,
      height: 12,
      id: "r1",
      color: "#123456"
    });
    map.setState(region.id, "free");
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
