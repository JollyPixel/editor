// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MaterialSurface } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { materialSwatch } from "#src/features/material/materialSwatch.ts";

describe("materialSwatch", () => {
  test("is empty and invites a material when the block has none", () => {
    assert.deepEqual(materialSwatch(null), { title: "Add material" });
  });

  test("names the material and samples its tint with its opacity as alpha", () => {
    const glass = {
      id: "glass",
      name: "Window",
      surface: MaterialSurface.create({ color: "#dff4ff", opacity: 0.45 })
    };

    assert.deepEqual(materialSwatch(glass), {
      title: "Material: Window",
      color: "#dff4ff73"
    });
  });

  test("rings a glowing material in its emissive colour", () => {
    function swatchRing(
      emissiveIntensity: number
    ) {
      return materialSwatch({
        name: "Glow",
        surface: MaterialSurface.create({ emissive: "#ff0000", emissiveIntensity })
      }).ring;
    }

    assert.equal(swatchRing(0.6), "#ff0000");
    assert.equal(swatchRing(0), undefined);
  });
});
