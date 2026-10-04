// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DEFAULT_UV_SLOTS } from "#src/uv/region/UVRegion.ts";
import {
  RECT_SIZE_THAT_FITS_A_LABEL,
  makeUvLabelSetup,
  uvLabelTexts
} from "../../helpers/uv/labels.ts";

describe("UVRegionLayer — face labels", () => {
  test("names only the selected face while the whole stack coincides", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "left");

    assert.deepStrictEqual(
      uvLabelTexts(svg),
      ["left +5"],
      "six labels on one pixel would be unreadable"
    );
  });

  test("keeps naming the next face down as the pile is peeled apart", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");

    const peeled = ["front", "back", "left"] as const;
    const labelsAfterEachPeel = peeled.map((face, index) => {
      map.select("r1", face);
      map.move(
        "r1",
        {
          x: (index + 1) * RECT_SIZE_THAT_FITS_A_LABEL * 2,
          y: 40,
          width: RECT_SIZE_THAT_FITS_A_LABEL,
          height: RECT_SIZE_THAT_FITS_A_LABEL
        },
        face
      );

      return uvLabelTexts(svg).sort();
    });

    assert.deepStrictEqual(
      labelsAfterEachPeel[0],
      ["back +4", "front"],
      "the remaining pile must announce what a click would pick, unclicked"
    );
    assert.deepStrictEqual(
      labelsAfterEachPeel.at(-1),
      ["back", "front", "left", "right +2"].sort(),
      "three separated faces plus the pile's new top, 'right'"
    );
  });

  test("names a pile belonging to a region that is not the selected one", () => {
    const { svg, map } = makeUvLabelSetup();
    const a = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1"
    });
    map.setState(a.id, "free");
    map.select("r1", "top");
    const b = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r2"
    });
    map.setState(b.id, "free");
    map.showAll = true;
    map.showRegionLabels = true;

    assert.deepStrictEqual(
      uvLabelTexts(svg).sort(),
      ["(r1)top +5", "(r2)front +5"],
      "r2's pile is named even though the selection lives in r1"
    );
  });

  test("names every face once their rects no longer coincide", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");

    DEFAULT_UV_SLOTS.forEach((face, index) => {
      map.move(
        "r1",
        {
          x: (index % 4) * RECT_SIZE_THAT_FITS_A_LABEL,
          y: Math.floor(index / 4) * RECT_SIZE_THAT_FITS_A_LABEL,
          width: RECT_SIZE_THAT_FITS_A_LABEL,
          height: RECT_SIZE_THAT_FITS_A_LABEL
        },
        face
      );
    });

    assert.deepStrictEqual(
      uvLabelTexts(svg).sort(),
      [...DEFAULT_UV_SLOTS].sort()
    );
  });

  test("a stacked region carries no label", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL
    });
    map.select(region.id);

    assert.deepStrictEqual(uvLabelTexts(svg), []);
  });

  test("showAll keeps face labels on free regions", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1"
    });
    map.setState(region.id, "free");

    map.showAll = true;

    assert.deepStrictEqual(uvLabelTexts(svg), ["front +5"]);
  });

  test("drops the label when the rect is too small on screen to hold it", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: 4,
      height: 4,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");

    assert.deepStrictEqual(uvLabelTexts(svg), []);
  });

  test("removes labels once the region is stacked again", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1"
    });
    map.setState(region.id, "free");
    map.select("r1", "front");
    assert.strictEqual(uvLabelTexts(svg).length, 1);

    map.setState("r1", "stacked");

    assert.deepStrictEqual(uvLabelTexts(svg), []);
  });
});
