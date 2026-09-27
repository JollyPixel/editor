// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SURFACE_GROUPS,
  sliderMax
} from "#src/features/material/surface/surfaceFields.ts";

describe("sliderMax", () => {
  test("ends a slider at the schema maximum, or at the field's own for an unbounded value", () => {
    const ends = SURFACE_GROUPS
      .flatMap((group) => group.fields)
      .flatMap((field) => (field.control === "slider" ? [[field.key, sliderMax(field)]] : []));

    assert.deepEqual(ends, [
      ["opacity", 1],
      ["roughness", 1],
      ["metalness", 1],
      ["emissiveIntensity", 5]
    ]);
  });
});
