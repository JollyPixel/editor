// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SchemaParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { MaterialSurface } from "#src/model/materials/MaterialSurface.ts";
import {
  materialSurfacePatchSchema,
  materialSurfaceSchema
} from "#src/network/VoxelModelCommand.schema.ts";

// CONSTANTS
const kSchema = new SchemaParser(materialSurfaceSchema);
const kPatchSchema = new SchemaParser(materialSurfacePatchSchema);
const kCases: readonly unknown[] = [
  MaterialSurface.create(),
  MaterialSurface.create({ opacity: 0, emissiveIntensity: 7 }),
  MaterialSurface.create({ opacity: 1.5 }),
  MaterialSurface.create({ roughness: -0.1 }),
  MaterialSurface.create({ metalness: 2 }),
  MaterialSurface.create({ emissiveIntensity: -1 }),
  MaterialSurface.create({ color: "red" }),
  MaterialSurface.create({ color: "#ABCDEF" }),
  MaterialSurface.create({ emissive: "#fff" }),
  { ...MaterialSurface.create(), opacity: "1" },
  { color: "#ffffff" },
  null,
  "#ffffff"
];

describe("MaterialSurface", () => {
  test("isValid agrees with the surface schema", () => {
    for (const value of kCases) {
      assert.equal(
        MaterialSurface.isValid(value),
        kSchema.parse(value).ok,
        JSON.stringify(value)
      );
    }
  });

  test("isPatch agrees with the surface patch schema", () => {
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
        MaterialSurface.isPatch(value),
        kPatchSchema.parse(value).ok,
        JSON.stringify(value)
      );
    }
  });

  test("rejects an invalid surface", () => {
    assert.throws(() => new MaterialSurface(MaterialSurface.create({ opacity: 1.5 })), RangeError);
  });

  test("tells whether it already holds every field of a patch", () => {
    const surface = new MaterialSurface(MaterialSurface.create({ opacity: 0.5 }));

    assert.equal(surface.holds({ opacity: 0.5 }), true);
    assert.equal(surface.holds({ opacity: 0.5, roughness: 0.2 }), false);
  });

  test("lists the fields another surface changes", () => {
    const json = MaterialSurface.create();
    const surface = new MaterialSurface(json);

    assert.deepEqual(surface.changesTo({ ...json }), {});
    assert.deepEqual(
      surface.changesTo({ ...json, opacity: 0.5, emissive: "#ff0000" }),
      { opacity: 0.5, emissive: "#ff0000" }
    );
  });
});
