// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  hueSaturationFromPointer,
  snapToWheel,
  wheelPosition
} from "../../src/color/wheel.ts";
import type { AreaRect } from "../../src/color/area.ts";

// CONSTANTS
const kRect: AreaRect = {
  left: 100,
  top: 50,
  width: 200,
  height: 200
};

function assertClose(
  actual: number,
  expected: number
): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

describe("Color.hueSaturationFromPointer", () => {
  test("puts hue 0 at the top and turns clockwise", () => {
    const top = hueSaturationFromPointer({ x: 200, y: 50 }, kRect);
    const right = hueSaturationFromPointer({ x: 300, y: 150 }, kRect);
    const bottom = hueSaturationFromPointer({ x: 200, y: 250 }, kRect);
    const left = hueSaturationFromPointer({ x: 100, y: 150 }, kRect);

    assertClose(top.h, 0);
    assertClose(right.h, 90);
    assertClose(bottom.h, 180);
    assertClose(left.h, 270);
    assertClose(top.s, 1);
  });

  test("reads saturation from the radius and clamps outside the disc", () => {
    assertClose(hueSaturationFromPointer({ x: 200, y: 150 }, kRect).s, 0);
    assertClose(hueSaturationFromPointer({ x: 250, y: 150 }, kRect).s, 0.5);
    assert.equal(hueSaturationFromPointer({ x: 500, y: 150 }, kRect).s, 1);
  });

  test("wheelPosition places the cursor back where the pointer was", () => {
    const picked = hueSaturationFromPointer({ x: 260, y: 90 }, kRect);
    const { x, y } = wheelPosition(picked);

    assertClose(x, 0.8);
    assertClose(y, 0.2);
  });
});

describe("Color.snapToWheel", () => {
  test("snaps hue to 30 degree sectors and saturation to quarter rings", () => {
    assert.deepEqual(snapToWheel({ h: 44, s: 0.6 }), { h: 30, s: 0.5 });
    assert.deepEqual(snapToWheel({ h: 350, s: 0.9 }), { h: 0, s: 1 });
    assert.deepEqual(snapToWheel({ h: 100, s: 0.1 }), { h: 90, s: 0 });
  });
});
