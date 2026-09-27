// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { createMaterialSurface } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  materialSwatch,
  surfaceGlows
} from "#src/shared/materialSwatch.ts";

describe("materialSwatch", () => {
  test("is empty and invites a material when the block has none", () => {
    assert.deepEqual(materialSwatch(null), { title: "Add material" });
  });

  test("names the material and samples its tint with its opacity as alpha", () => {
    const glass = {
      id: "glass",
      name: "Window",
      surface: createMaterialSurface({ color: "#dff4ff", opacity: 0.45 })
    };

    assert.deepEqual(materialSwatch(glass), {
      title: "Material: Window",
      color: "#dff4ff73"
    });
  });

  test("rings a glowing material in its emissive colour", () => {
    function ringOf(
      emissiveIntensity: number
    ) {
      return materialSwatch({
        name: "Glow",
        surface: createMaterialSurface({ emissive: "#ff0000", emissiveIntensity })
      }).ring;
    }

    assert.equal(ringOf(0.6), "#ff0000");
    assert.equal(ringOf(0), undefined);
  });
});

describe("surfaceGlows", () => {
  test("is off at zero intensity or with a black glow color", () => {
    assert.equal(surfaceGlows(createMaterialSurface({ emissive: "#ffcc66" })), true);
    assert.equal(surfaceGlows(createMaterialSurface({ emissive: "#ffcc66", emissiveIntensity: 0 })), false);
    assert.equal(surfaceGlows(createMaterialSurface()), false);
  });
});
