// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ratioFromPointer,
  saturationValueFromPointer,
  type AreaRect
} from "../../src/color/area.ts";

// CONSTANTS
const kRect: AreaRect = {
  left: 100,
  top: 50,
  width: 200,
  height: 100
};

describe("Color.ratioFromPointer", () => {
  test("maps the corners to 0 and 1", () => {
    assert.deepEqual(
      ratioFromPointer({
        x: 100,
        y: 50
      }, kRect),
      {
        x: 0,
        y: 0
      }
    );
    assert.deepEqual(
      ratioFromPointer({
        x: 300,
        y: 150
      }, kRect),
      {
        x: 1,
        y: 1
      }
    );
  });

  test("maps the centre to a half on both axes", () => {
    assert.deepEqual(
      ratioFromPointer({
        x: 200,
        y: 100
      }, kRect),
      {
        x: 0.5,
        y: 0.5
      }
    );
  });

  test("clamps a drag that leaves the rectangle", () => {
    assert.deepEqual(
      ratioFromPointer({
        x: -400,
        y: 900
      }, kRect),
      {
        x: 0,
        y: 1
      }
    );
  });

  test("yields zero for an unlaid-out rectangle instead of dividing by zero", () => {
    assert.deepEqual(
      ratioFromPointer({
        x: 10,
        y: 10
      }, {
        left: 0,
        top: 0,
        width: 0,
        height: 0
      }),
      {
        x: 0,
        y: 0
      }
    );
  });
});

describe("Color.saturationValueFromPointer", () => {
  test("increases saturation to the right and value upwards", () => {
    assert.deepEqual(
      saturationValueFromPointer({
        x: 300,
        y: 50
      }, kRect),
      {
        s: 1,
        v: 1
      }
    );
  });

  test("puts black in the bottom-left corner", () => {
    assert.deepEqual(
      saturationValueFromPointer({
        x: 100,
        y: 150
      }, kRect),
      {
        s: 0,
        v: 0
      }
    );
  });

  test("puts white in the top-left corner", () => {
    assert.deepEqual(
      saturationValueFromPointer({
        x: 100,
        y: 50
      }, kRect),
      {
        s: 0,
        v: 1
      }
    );
  });
});
