// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LightFalloff } from "../../../src/view/lighting/LightFalloff.ts";
import {
  LIGHT_OPAQUE,
  packLight
} from "../../../src/view/lighting/packedLight.ts";

function ratio(
  falloff: LightFalloff,
  level: number
): number {
  return falloff.brightness(level) / falloff.brightness(15);
}

describe("LightFalloff", () => {
  it("names its curves", () => {
    assert.equal(LightFalloff.of("wide"), LightFalloff.WIDE);
    assert.equal(LightFalloff.of("focused"), LightFalloff.FOCUSED);
    assert.equal(LightFalloff.FOCUSED.name, "focused");
  });

  it("peaks at the source and is dark at level 0", () => {
    for (const falloff of [LightFalloff.WIDE, LightFalloff.FOCUSED]) {
      assert.equal(falloff.brightness(15), 1);
      assert.equal(falloff.byteOf(15), 255);
      assert.equal(falloff.brightness(0), 0);
    }
  });

  it("fades the focused curve faster but boosts it at the source", () => {
    for (const level of [14, 12, 8]) {
      assert.ok(ratio(LightFalloff.FOCUSED, level) < ratio(LightFalloff.WIDE, level));
    }
    assert.ok(LightFalloff.FOCUSED.peak > LightFalloff.WIDE.peak);
  });

  it("picks the tinted level whose brightness matches the colour share", () => {
    const falloff = LightFalloff.WIDE;
    const level = falloff.tintedLevel(15, 0.5);

    assert.equal(level, 11);
    assert.ok(
      Math.abs(falloff.brightness(level) - 0.5) <
        Math.abs(falloff.brightness(level + 1) - 0.5)
    );
    assert.equal(falloff.tintedLevel(15, 1), 15);
    assert.equal(falloff.tintedLevel(15, 0), 0);
  });

  it("maps a packed cell to an RGBA texel premultiplied by openness", () => {
    const bytes = new Uint8Array(new Uint32Array([
      LightFalloff.WIDE.texelOf(packLight(15, 0, 0)),
      LightFalloff.WIDE.texelOf(packLight(15, 15, 15) | LIGHT_OPAQUE)
    ]).buffer);

    assert.deepEqual([...bytes], [255, 0, 0, 255, 0, 0, 0, 0]);
  });
});
