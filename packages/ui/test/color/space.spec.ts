// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PickerSpace } from "../../src/color/space.ts";

describe("Color.PickerSpace", () => {
  test("convert keeps the color and the hue of a gray", () => {
    const orange = PickerSpace.hsv.fromRgb({ r: 1, g: 0.4, b: 0, a: 1 });
    const converted = PickerSpace.hsv.convert(orange, PickerSpace.okhsv);
    assert.equal(PickerSpace.okhsv.hex(converted), "#ff6600");

    const gray = {
      h: 75,
      s: 0,
      v: 0.5,
      a: 1
    };
    assert.equal(PickerSpace.hsv.convert(gray, PickerSpace.okhsv).h, 75);
  });

  test("ramps start and end where the track does", () => {
    const point = {
      h: 200,
      s: 1,
      v: 0.3,
      a: 1
    };

    for (const space of [PickerSpace.hsv, PickerSpace.okhsv]) {
      const stops = space.valueRamp(point).split(", ");
      assert.equal(stops[0], "#000000");
      assert.equal(stops.at(-1), space.hex({ ...point, v: 1 }));
      assert.equal(space.hueRamp.split(", ").at(0), space.hueRamp.split(", ").at(-1));
    }
  });
});
