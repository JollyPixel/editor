// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import { rectOf } from "#src/uv/geometry/geometry.ts";
import {
  makeSvg,
  makeViewport
} from "../../helpers/overlay.ts";
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import { makeUvMap } from "../../helpers/uv/map.ts";
import { livePreview } from "../../helpers/uv/overlay.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
const kZoom = 4;
const kInset = 6;
const kGap = 14;

function makeSetup() {
  const svg = makeSvg();
  const map = makeUvMap({ x: 64, y: 64 });
  const layer = new UVRegionLayer(svg, makeViewport(kZoom), map);

  return { svg, map, layer };
}

function sizeLabels(
  svg: SVGElement
): SVGTextElement[] {
  return [...svg.querySelectorAll<SVGTextElement>("[data-overlay='uv-size']")];
}

function sizeTexts(
  svg: SVGElement
): (string | null)[] {
  return sizeLabels(svg).map((el) => el.textContent);
}

function screenBottom(
  rect: SelectionRect
): number {
  return (rect.y + rect.height) * kZoom;
}

describe("UVRegionLayer — size labels", () => {
  test("shows nothing until size labels are enabled", () => {
    const { svg, map } = makeSetup();
    const region = map.create({ width: 4, height: 6 });
    map.select(region.id);

    assert.deepStrictEqual(sizeTexts(svg), []);

    map.showSizeLabels = true;
    assert.deepStrictEqual(sizeTexts(svg), ["4×6"]);

    map.showSizeLabels = false;
    assert.deepStrictEqual(sizeTexts(svg), []);
  });

  test("labels a stacked region below its bottom-right corner in its color", () => {
    const { svg, map } = makeSetup();
    const region = map.create({ width: 4, height: 6, color: "#ff0000" });
    map.select(region.id);
    map.showSizeLabels = true;

    const [label] = sizeLabels(svg);
    assert.strictEqual(label.getAttribute("visibility"), "visible");
    assert.strictEqual(label.getAttribute("fill"), "#ff0000");
    assert.strictEqual(
      label.getAttribute("y"),
      String(screenBottom(region.bounds) + kGap)
    );
  });

  test("labels a 1x1 region", () => {
    const { svg, map } = makeSetup();
    const region = map.create({ width: 1, height: 1 });
    map.select(region.id);
    map.showSizeLabels = true;

    assert.deepStrictEqual(sizeTexts(svg), ["1×1"]);
    assert.strictEqual(sizeLabels(svg)[0].getAttribute("visibility"), "visible");
  });

  test("labels only the selected region while every region is shown", () => {
    const { svg, map } = makeSetup();
    map.create({ width: 4, height: 4 });
    const selected = map.create({ width: 5, height: 3 });
    map.showAll = true;
    map.showSizeLabels = true;

    assert.deepStrictEqual(sizeTexts(svg), []);

    map.select(selected.id);
    assert.deepStrictEqual(sizeTexts(svg), ["5×3"]);
  });

  test("labels only the selected slot of a free region", () => {
    const { svg, map } = makeSetup();
    const region = map.create({ width: 4, height: 4, id: "r1" });
    map.setState(region.id, "free");
    map.resize(region.id, { x: 0, y: 0, width: 7, height: 2 }, "top");
    map.select(region.id, "top");
    map.showSizeLabels = true;

    assert.deepStrictEqual(sizeTexts(svg), ["7×2"]);

    map.select(region.id, "front");
    assert.deepStrictEqual(sizeTexts(svg), ["4×4"]);
  });

  test("follows a live resize preview", () => {
    const { svg, map, layer } = makeSetup();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);
    map.showSizeLabels = true;

    layer.setLivePreview(
      livePreview(map.previewResize(region.id, { ...region.bounds, width: 9 }))
    );
    assert.deepStrictEqual(sizeTexts(svg), ["9×4"]);

    layer.setLivePreview(null);
    assert.deepStrictEqual(sizeTexts(svg), ["4×4"]);
  });

  test("labels every net face inside its bottom-right corner", () => {
    const { svg, map } = makeSetup();
    const region = map.create({ width: 8, height: 8, id: "r1" });
    map.setState(region.id, "unfolded");
    map.select(region.id);
    map.showSizeLabels = true;

    const faces = map.get(region.id)!.slotsOf();
    const labels = sizeLabels(svg);
    assert.strictEqual(labels.length, faces.length);
    assert.deepStrictEqual(
      labels.map((label) => label.getAttribute("y")).sort(),
      faces.map(({ geometry }) => String(screenBottom(rectOf(geometry)) - kInset)).sort()
    );
    assert.ok(labels.every((label) => label.getAttribute("visibility") === "visible"));
  });

  test("labels a triangle face at its right angle, below the slot label lines", () => {
    const { svg, map } = makeSetup();
    map.restore(new UVRegion({
      id: "ramp",
      color: "#ff0000",
      state: "unfolded",
      faces: {
        left: {
          shape: "triangle",
          corner: "top-left",
          rect: { x: 0, y: 0, width: 24, height: 24 }
        },
        back: { x: 30, y: 0, width: 8, height: 8 }
      }
    }));
    map.select("ramp");
    map.showSizeLabels = true;

    const label = sizeLabels(svg).find((el) => el.textContent === "24×24")!;
    assert.strictEqual(label.getAttribute("x"), "3");
    assert.strictEqual(label.getAttribute("y"), "23");
    assert.strictEqual(label.getAttribute("text-anchor"), "start");

    map.showRegionLabels = true;
    assert.strictEqual(label.getAttribute("y"), "33");
  });

  test("keeps a resized net face size outside while it is too small to fit inside", () => {
    const { svg, map, layer } = makeSetup();
    const region = map.create({ width: 3, height: 3, id: "r1" });
    map.setState(region.id, "unfolded");
    map.select(region.id);
    map.showSizeLabels = true;

    const front = rectOf(map.get(region.id)!.geometryFor("front"));
    const preview = map.previewResize(
      region.id,
      { ...front, width: front.width + 1 },
      "front"
    )!;
    layer.setLivePreview({ region: preview, slot: "front" });

    const resized = rectOf(preview.geometryFor("front"));
    const visible = sizeLabels(svg).filter(
      (label) => label.getAttribute("visibility") === "visible"
    );
    assert.deepStrictEqual(
      visible.map((label) => label.textContent),
      [`${resized.width}×${resized.height}`]
    );
    assert.strictEqual(
      visible[0].getAttribute("y"),
      String(screenBottom(resized) + kGap)
    );
  });

  test("keeps a resized net face size inside when outside would cover a face", () => {
    const { svg, map, layer } = makeSetup();
    const region = map.create({ width: 8, height: 8, id: "r1" });
    map.setState(region.id, "unfolded");
    map.select(region.id);
    map.showSizeLabels = true;

    const front = rectOf(map.get(region.id)!.geometryFor("front"));
    const preview = map.previewResize(
      region.id,
      { ...front, width: front.width + 1 },
      "front"
    )!;
    layer.setLivePreview({ region: preview, slot: "front" });

    const resized = rectOf(preview.geometryFor("front"));
    const label = sizeLabels(svg).find(
      (el) => el.textContent === `${resized.width}×${resized.height}`
    )!;
    assert.strictEqual(
      label.getAttribute("y"),
      String(screenBottom(resized) - kInset)
    );
  });

  test("moves the size inside when outside would cover another region", () => {
    const { svg, map } = makeSetup();
    const selected = map.create({ width: 8, height: 8 });
    const below = map.create({ width: 16, height: 4 });
    map.move(selected.id, { x: 0, y: 0, width: 8, height: 8 });
    map.move(below.id, { x: 0, y: 9, width: 16, height: 4 });
    map.select(selected.id);
    map.showSizeLabels = true;

    const [label] = sizeLabels(svg);
    assert.strictEqual(label.getAttribute("y"), String((8 * kZoom) + kGap));

    map.showAll = true;
    assert.strictEqual(label.getAttribute("y"), String((8 * kZoom) - kInset));
    assert.strictEqual(label.getAttribute("text-anchor"), "end");
  });

  test("keeps the size outside when it covers another region but cannot fit inside", () => {
    const { svg, map } = makeSetup();
    const selected = map.create({ width: 3, height: 3 });
    const below = map.create({ width: 16, height: 4 });
    map.move(selected.id, { x: 0, y: 0, width: 3, height: 3 });
    map.move(below.id, { x: 0, y: 4, width: 16, height: 4 });
    map.select(selected.id);
    map.showAll = true;
    map.showSizeLabels = true;

    const [label] = sizeLabels(svg);
    assert.strictEqual(label.getAttribute("y"), String((3 * kZoom) + kGap));
    assert.strictEqual(label.getAttribute("visibility"), "visible");
  });
});
