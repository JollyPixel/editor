// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  LightDefinition,
  MeshDefinition,
  MESH_GEOMETRY_DEFAULTS
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  defaultsSource,
  fieldChange,
  fieldReset,
  lightForm,
  meshForm,
  readField,
  type FormRow
} from "../../src/components/componentForms.ts";

function rowAt(
  rows: readonly FormRow[],
  ...path: string[]
): FormRow {
  const row = rows.find((candidate) => candidate.path.join(".") === path.join("."));
  assert.ok(row, `no row for ${path.join(".")}`);

  return row;
}

function labels(
  rows: readonly FormRow[]
): string[] {
  return rows.map((row) => row.path.join("."));
}

describe("componentForms", () => {
  test("shows the light fields of the light's kind", () => {
    const light = new LightDefinition();

    const spot = labels(lightForm(light.parse({ kind: "spot" })));
    const hemisphere = labels(lightForm(light.parse({ kind: "hemisphere" })));

    assert.ok(spot.includes("angle") && spot.includes("castShadow"));
    assert.ok(!spot.includes("groundColor"));
    assert.ok(hemisphere.includes("groundColor"));
    assert.ok(!hemisphere.includes("castShadow"));
  });

  test("writes a top-level field as a one-field patch", () => {
    const rows = lightForm(new LightDefinition().parse({}));

    assert.deepEqual(
      fieldChange({ kind: "point" }, rowAt(rows, "intensity"), 2),
      { data: { intensity: 2 } }
    );
  });

  test("merges a nested field into the stored object, not the parsed defaults", () => {
    const mesh = new MeshDefinition();
    const stored = { geometry: { kind: "sphere", radius: 2 } };
    const rows = meshForm(mesh.parse(stored));

    assert.deepEqual(
      fieldChange(stored, rowAt(rows, "geometry", "widthSegments"), 8),
      { data: { geometry: { kind: "sphere", radius: 2, widthSegments: 8 } } }
    );
  });

  test("drops the previous geometry's fields when the geometry kind changes", () => {
    const stored = { geometry: { kind: "box", width: 3 } };
    const rows = meshForm(new MeshDefinition().parse(stored));

    assert.deepEqual(
      fieldChange(stored, rowAt(rows, "geometry", "kind"), "torus"),
      { data: { geometry: { kind: "torus" } } }
    );
  });

  test("resets a top-level field by unsetting it and a nested one by dropping its key", () => {
    assert.deepEqual(fieldReset({ intensity: 3 }, ["intensity"]), { unset: ["intensity"] });
    assert.deepEqual(
      fieldReset({ material: { color: "#ff0000", roughness: 0.2 } }, ["material", "color"]),
      { data: { material: { roughness: 0.2 } } }
    );
  });

  test("reads a nested field's default from its object's kind", () => {
    const mesh = new MeshDefinition();
    const parsed = mesh.parse({ geometry: { kind: "sphere", radius: 4 } });

    const fallback = readField(
      mesh.parse(defaultsSource(parsed)),
      ["geometry", "radius"]
    );

    assert.strictEqual(readField(parsed, ["geometry", "radius"]), 4);
    assert.strictEqual(fallback, MESH_GEOMETRY_DEFAULTS.sphere.radius);
  });
});
