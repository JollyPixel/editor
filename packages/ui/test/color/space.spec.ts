// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PickerSpace } from "../../src/color/space.ts";

describe("Color.PickerSpace", () => {
  test("ramps start and end where the track does", () => {
    const point = {
      h: 200,
      s: 1,
      v: 0.3,
      a: 1
    };

    for (const space of [PickerSpace.hsv, PickerSpace.okhsv, PickerSpace.okhsl]) {
      const stops = space.valueRamp(point).split(", ");
      assert.equal(stops[0], "#000000");
      assert.equal(stops.at(-1), space.hex({ ...point, v: 1 }));
      assert.equal(space.hueRamp.split(", ").at(0), space.hueRamp.split(", ").at(-1));
    }
  });

  test("labels the level axis and starts the okhsl hue ramp below white", () => {
    assert.equal(PickerSpace.hsv.axisLabel, "Value");
    assert.equal(PickerSpace.named("okhsl").axisLabel, "Lightness");
    assert.notEqual(PickerSpace.okhsl.hueRamp.split(", ")[0], "#ffffff");
  });
});
