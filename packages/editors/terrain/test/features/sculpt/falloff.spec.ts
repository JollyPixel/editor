// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FALLOFF_CURVES,
  falloffWeight,
  halfWeightDistance
} from "#src/features/sculpt/model/falloff.ts";

describe("falloff", () => {
  test("every curve is full at the centre, never rises outward and is zero past the radius", () => {
    for (const curve of FALLOFF_CURVES) {
      assert.equal(falloffWeight(curve, 0), 1, curve);
      assert.equal(falloffWeight(curve, 1.01), 0, curve);
      for (let distance = 0.05; distance <= 1; distance += 0.05) {
        assert.ok(falloffWeight(curve, distance) <= falloffWeight(curve, distance - 0.05), curve);
      }
    }
    assert.equal(falloffWeight("constant", 1), 1);
    assert.equal(falloffWeight("linear", 1), 0);
  });

  test("the inner ring sits where the weight drops to a half", () => {
    for (const curve of FALLOFF_CURVES) {
      const distance = halfWeightDistance(curve);
      if (curve === "constant") {
        assert.equal(distance, null);
      }
      else {
        assert.ok(Math.abs(falloffWeight(curve, distance!) - 0.5) < 1e-5, curve);
      }
    }
    assert.ok(Math.abs(halfWeightDistance("linear")! - 0.5) < 1e-6);
  });
});
