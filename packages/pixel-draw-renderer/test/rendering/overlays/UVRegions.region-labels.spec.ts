// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  RECT_SIZE_THAT_FITS_A_LABEL,
  makeUvLabelSetup,
  uvLabelTexts
} from "../../helpers/uv/labels.ts";

describe("UVRegionLayer — region labels", () => {
  function labelLines(
    svg: SVGElement
  ): string[] {
    return [
      ...svg.querySelectorAll("text tspan")
    ].map((el) => el.textContent ?? "");
  }

  test("shows a stacked region name when region labels are enabled", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1",
      name: "Grass block"
    });
    map.select(region.id);

    map.showRegionLabels = true;

    assert.deepStrictEqual(uvLabelTexts(svg), ["(Grass block)"]);
  });

  test("falls back to the region id when the name is blank", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "region-1",
      name: "   "
    });
    map.select(region.id);

    map.showRegionLabels = true;

    assert.deepStrictEqual(uvLabelTexts(svg), ["(region-1)"]);
  });

  test("puts the region label above the face for an free region", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1",
      name: "Grass block"
    });
    map.setState(region.id, "free");
    map.select(region.id, "front");

    map.showRegionLabels = true;

    assert.deepStrictEqual(labelLines(svg), ["(Grass block)", "front +5"]);
  });

  test("truncates only the displayed region label to twenty characters", () => {
    const { svg, map } = makeUvLabelSetup();
    const region = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1",
      name: "abcdefghijklmnopqrstuv"
    });
    map.select(region.id);

    map.showRegionLabels = true;

    assert.deepStrictEqual(uvLabelTexts(svg), ["(abcdefghijklmnopqrs…)"]);
    assert.strictEqual(region.name, "abcdefghijklmnopqrstuv");
  });

  test("showAll shows every region without labelling it", () => {
    const { svg, map } = makeUvLabelSetup();
    map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1"
    });
    map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r2"
    });

    map.showAll = true;

    assert.strictEqual(
      svg.querySelectorAll("g > rect:last-child").length,
      2
    );
    assert.deepStrictEqual(uvLabelTexts(svg), []);

    map.showRegionLabels = true;
    assert.deepStrictEqual(uvLabelTexts(svg).sort(), ["(r1)", "(r2)"]);

    map.showAll = false;
    assert.deepStrictEqual(uvLabelTexts(svg), []);
    assert.strictEqual(map.showRegionLabels, true);
  });

  test("labelScope selected labels only the selected region", () => {
    const { svg, map } = makeUvLabelSetup();
    map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r1"
    });
    const b = map.create({
      width: RECT_SIZE_THAT_FITS_A_LABEL,
      height: RECT_SIZE_THAT_FITS_A_LABEL,
      id: "r2"
    });
    map.setState(b.id, "free");
    map.showAll = true;
    map.showRegionLabels = true;

    map.labelScope = "selected";
    assert.deepStrictEqual(uvLabelTexts(svg), []);
    assert.strictEqual(
      svg.querySelectorAll("g > rect:last-child").length,
      7,
      "every border stays drawn"
    );

    map.select("r2", "front");
    assert.deepStrictEqual(uvLabelTexts(svg), ["(r2)front +5"]);

    map.select("r1");
    assert.deepStrictEqual(uvLabelTexts(svg), ["(r1)"]);

    map.labelScope = "all";
    assert.deepStrictEqual(uvLabelTexts(svg).sort(), ["(r1)", "(r2)front +5"]);
  });
});
