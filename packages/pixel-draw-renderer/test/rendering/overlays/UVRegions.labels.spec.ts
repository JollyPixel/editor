// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegionLayer } from "#src/rendering/overlays/UVRegions.ts";
import { DEFAULT_UV_SLOTS } from "#src/uv/UVRegion.ts";
import {
  makeSvg,
  makeViewport,
  makeUvMap
} from "../../helpers/overlay.ts";

describe("UVRegionLayer — face labels", () => {
  // makeViewport() zooms 4x and labels need 40 screen px, so a labelled
  // rect must be at least 10 texture px wide/tall.
  const kLabelSize = 12;

  function setup(): { svg: SVGElement; map: ReturnType<typeof makeUvMap>; } {
    const svg = makeSvg();
    const map = makeUvMap();
    new UVRegionLayer(
      svg,
      makeViewport(),
      map
    );

    return { svg, map };
  }

  function labels(
    svg: SVGElement
  ): (string | null)[] {
    return [
      ...svg.querySelectorAll("text")
    ].map((el) => el.textContent);
  }

  function labelLines(
    svg: SVGElement
  ): string[] {
    return [
      ...svg.querySelectorAll("text tspan")
    ].map((el) => el.textContent ?? "");
  }

  test("names only the selected face while the whole stack coincides", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "left");

    assert.deepStrictEqual(
      labels(svg),
      ["left +5"],
      "six labels on one pixel would be unreadable"
    );
  });

  test("names the next face as soon as the selected one is dragged off the pile", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");
    assert.deepStrictEqual(labels(svg), ["front +5"]);

    map.move(
      "r1",
      { x: 40, y: 40, width: kLabelSize, height: kLabelSize },
      "front"
    );

    assert.deepStrictEqual(
      labels(svg).sort(),
      ["back +4", "front"],
      "the remaining pile must announce what a click would pick, unclicked"
    );
  });

  test("keeps naming the next face down as the pile is peeled apart", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");

    // Peel the first three off, one at a time.
    const peeled = ["front", "back", "left"] as const;
    peeled.forEach((face, index) => {
      map.select("r1", face);
      map.move(
        "r1",
        {
          x: (index + 1) * kLabelSize * 2,
          y: 40,
          width: kLabelSize,
          height: kLabelSize
        },
        face
      );
    });

    assert.deepStrictEqual(
      labels(svg).sort(),
      ["back", "front", "left", "right +2"].sort(),
      "three separated faces plus the pile's new top, 'right'"
    );
  });

  test("names a pile belonging to a region that is not the selected one", () => {
    const { svg, map } = setup();
    const a = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1"
    });
    map.setState(a.id, "free");
    map.select("r1", "top");
    // Show a second, unselected free region alongside it.
    const b = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r2"
    });
    map.setState(b.id, "free");
    map.showAll = true;

    assert.deepStrictEqual(
      labels(svg).sort(),
      ["(r1)top +5", "(r2)front +5"],
      "r2's pile is named even though the selection lives in r1"
    );
  });

  test("names every face once their rects no longer coincide", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");

    DEFAULT_UV_SLOTS.forEach((face, index) => {
      map.move(
        "r1",
        {
          x: (index % 4) * kLabelSize,
          y: Math.floor(index / 4) * kLabelSize,
          width: kLabelSize,
          height: kLabelSize
        },
        face
      );
    });

    assert.deepStrictEqual(
      labels(svg).sort(),
      [...DEFAULT_UV_SLOTS].sort()
    );
  });

  test("a stacked region carries no label", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize
    });
    map.select(region.id);

    assert.deepStrictEqual(labels(svg), []);
  });

  test("shows a stacked region name when region labels are enabled", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1",
      name: "Grass block"
    });
    map.select(region.id);

    map.showRegionLabels = true;

    assert.deepStrictEqual(labels(svg), ["(Grass block)"]);
  });

  test("falls back to the region id when the name is blank", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "region-1",
      name: "   "
    });
    map.select(region.id);

    map.showRegionLabels = true;

    assert.deepStrictEqual(labels(svg), ["(region-1)"]);
  });

  test("puts the region label above the face for an free region", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1",
      name: "Grass block"
    });
    map.setState(region.id, "free");
    map.select(region.id, "front");

    map.showRegionLabels = true;

    assert.deepStrictEqual(labelLines(svg), ["(Grass block)", "front +5"]);
  });

  test("truncates only the displayed region label to twenty characters", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1",
      name: "abcdefghijklmnopqrstuv"
    });
    map.select(region.id);

    map.showRegionLabels = true;

    assert.deepStrictEqual(labels(svg), ["(abcdefghijklmnopqrs…)"]);
    assert.strictEqual(region.name, "abcdefghijklmnopqrstuv");
  });

  test("showAll forces labels without changing the stored preference", () => {
    const { svg, map } = setup();
    map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1"
    });
    map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r2"
    });

    map.showAll = true;

    assert.deepStrictEqual(labels(svg).sort(), ["(r1)", "(r2)"]);
    assert.strictEqual(
      map.showRegionLabels,
      false
    );

    map.showAll = false;
    assert.deepStrictEqual(labels(svg), []);
  });

  test("drops the label when the rect is too small on screen to hold it", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: 4,
      height: 4,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");

    assert.deepStrictEqual(labels(svg), []);
  });

  test("removes labels once the region is stacked again", () => {
    const { svg, map } = setup();
    const region = map.create({
      width: kLabelSize,
      height: kLabelSize,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");
    assert.strictEqual(labels(svg).length, 1);

    map.setState("r1", "stacked");

    assert.deepStrictEqual(labels(svg), []);
  });
});
