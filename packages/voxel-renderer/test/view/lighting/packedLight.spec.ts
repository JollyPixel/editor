// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  brightestLight,
  dimLight,
  grayLight,
  lightChannel,
  packLight
} from "../../../src/view/lighting/packedLight.ts";

function channels(
  light: number
): [number, number, number] {
  return [lightChannel(light, 0), lightChannel(light, 1), lightChannel(light, 2)];
}

describe("packedLight", () => {
  it("packs three 0-15 channels", () => {
    assert.deepEqual(channels(packLight(15, 7, 0)), [15, 7, 0]);
    assert.deepEqual(channels(grayLight(9)), [9, 9, 9]);
  });

  it("dims each lit channel by one and leaves dark ones at zero", () => {
    assert.deepEqual(channels(dimLight(packLight(15, 1, 0))), [14, 0, 0]);
    assert.equal(dimLight(0), 0);
  });

  it("keeps the brightest value of each channel", () => {
    assert.deepEqual(
      channels(brightestLight(packLight(12, 0, 3), packLight(4, 9, 3))),
      [12, 9, 3]
    );
  });
});
