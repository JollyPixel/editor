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

describe("UVRegionLayer — visibility follows UVMap state", () => {
  test("renders nothing for a region that isn't selected or shown", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    map.create({ width: 4, height: 4 });

    assert.strictEqual(
      uvBorderRects(svg).length,
      0,
      "no rects when map is not selected or shown"
    );
  });

  test("renders a solid border rect once its region is selected", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 2,
      height: 3,
      id: "r1",
      color: "#123456"
    });
    map.select(region.id);

    const rects = uvBorderRects(svg);
    assert.strictEqual(rects.length, 1);
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
      uvCasingRects(svg)[0].style.display,
      "none",
      "the classical border keeps its contrasting casing"
    );
  });

  test("insets the casing so it never paints outside the border", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({ width: 2, height: 3, id: "r1" });
    map.select(region.id);

    const [casing] = uvCasingRects(svg);
    assert.strictEqual(casing.getAttribute("x"), "1");
    assert.strictEqual(casing.getAttribute("y"), "1");
    assert.strictEqual(casing.getAttribute("width"), "6");
    assert.strictEqual(casing.getAttribute("height"), "10");
  });

  test("never inverts the casing rect on a region a few screen pixels wide", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(1), map);

    const region = map.create({
      width: 1,
      height: 1,
      id: "r1"
    });
    map.select(region.id);

    const [casing] = uvCasingRects(svg);
    assert.strictEqual(casing.getAttribute("width"), "0");
    assert.strictEqual(casing.getAttribute("height"), "0");
  });

  test("showAll renders every region regardless of selection", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

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
      uvBorderRects(svg).length,
      2,
      "two rects when showAll is true"
    );
  });

  test("removes the rect once its region is deselected", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

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
      uvBorderRects(svg).length,
      1,
      "one rect when region is selected"
    );

    map.select(null);
    assert.strictEqual(
      uvBorderRects(svg).length,
      0,
      "no rect when region is deselected"
    );
  });

  test("removes the rect once its region is deleted", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

    new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 2,
      height: 2
    });
    map.showAll = true;
    assert.strictEqual(
      uvBorderRects(svg).length,
      1,
      "one rect when showAll is true"
    );

    map.delete(region.id);
    assert.strictEqual(
      uvBorderRects(svg).length,
      0,
      "no rect when region is deleted"
    );
  });

  test("moving a visible region updates its screen position", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });

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

    const [rect] = uvBorderRects(svg);
    assert.strictEqual(rect.getAttribute("x"), "20");
    assert.strictEqual(rect.getAttribute("y"), "20");
  });
});

describe("UVRegionLayer — setLivePreview", () => {
  test("renders the live preview instead of the stored region", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });
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

    overlay.setLivePreview(
      map.previewMove(region.id, {
        x: 9, y: 9, width: 2, height: 2
      })
    );

    const [rect] = uvBorderRects(svg);
    assert.strictEqual(rect.getAttribute("x"), "36");
    assert.strictEqual(rect.getAttribute("y"), "36");

    overlay.setLivePreview(null);
    assert.strictEqual(rect.getAttribute("x"), "0");
  });
});

describe("UVRegionLayer — destroy", () => {
  test("stops reacting to UVMap events and removes its rects", () => {
    const svg = makeSvg();
    const map = makeUvMap({ x: 64, y: 64 });
    const overlay = new UVRegionLayer(svg, makeViewport(), map);

    const region = map.create({
      width: 2,
      height: 2
    });
    map.showAll = true;
    assert.strictEqual(
      uvBorderRects(svg).length,
      1,
      "one rect when showAll is true"
    );

    overlay.destroy();
    assert.strictEqual(
      uvBorderRects(svg).length,
      0,
      "no rect after destroy"
    );

    map.move(
      region.id,
      { x: 1, y: 1, width: 2, height: 2 }
    );
    assert.strictEqual(
      uvBorderRects(svg).length,
      0,
      "no rect after move"
    );
  });
});
