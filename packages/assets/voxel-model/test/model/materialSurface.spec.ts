// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SchemaParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  createMaterialSurface,
  isMaterialSurface,
  isMaterialSurfacePatch
} from "#src/model/materialSurface.ts";
import {
  materialSurfacePatchSchema,
  materialSurfaceSchema
} from "#src/network/VoxelModelCommand.schema.ts";

// CONSTANTS
const kSchema = new SchemaParser(materialSurfaceSchema);
const kPatchSchema = new SchemaParser(materialSurfacePatchSchema);
const kCases: readonly unknown[] = [
  createMaterialSurface(),
  createMaterialSurface({ opacity: 0, emissiveIntensity: 7 }),
  createMaterialSurface({ opacity: 1.5 }),
  createMaterialSurface({ roughness: -0.1 }),
  createMaterialSurface({ metalness: 2 }),
  createMaterialSurface({ emissiveIntensity: -1 }),
  createMaterialSurface({ color: "red" }),
  createMaterialSurface({ color: "#ABCDEF" }),
  createMaterialSurface({ emissive: "#fff" }),
  { ...createMaterialSurface(), opacity: "1" },
  { color: "#ffffff" },
  null,
  "#ffffff"
];

describe("isMaterialSurface", () => {
  test("agrees with the surface schema", () => {
    for (const value of kCases) {
      assert.equal(
        isMaterialSurface(value),
        kSchema.parse(value).ok,
        JSON.stringify(value)
      );
    }
  });
});

describe("isMaterialSurfacePatch", () => {
  test("agrees with the surface patch schema", () => {
    const cases: readonly unknown[] = [
      ...kCases,
      { roughness: 0.2 },
      { emissive: "#ff0000", emissiveIntensity: 3 },
      { opacity: 2 },
      { shine: 1 },
      { color: "#ffffff", shine: 1 },
      {}
    ];

    for (const value of cases) {
      assert.equal(
        isMaterialSurfacePatch(value),
        kPatchSchema.parse(value).ok,
        JSON.stringify(value)
      );
    }
  });
});
