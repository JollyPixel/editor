// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  LIGHT_DEFAULTS,
  MESH_GEOMETRY_DEFAULTS
} from "@jolly-pixel/engine";
import {
  ComponentChange,
  type JSONObject,
  type SceneComponentJSON
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import {
  ComponentInspection,
  type InspectedRow
} from "../../src/components/ComponentInspection.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

// CONSTANTS
const kComponents = createSceneComponents();

function inspect(
  type: string,
  data: JSONObject
): ComponentInspection {
  const kind = kComponents.find(type);
  assert.ok(kind, `no component kind ${type}`);
  const entry: SceneComponentJSON = {
    id: "component",
    type,
    data,
    assets: {}
  };

  return new ComponentInspection(entry, kind);
}

function rowAt(
  inspection: ComponentInspection,
  ...path: string[]
): InspectedRow {
  const inspected = inspection.rows.find(
    (candidate) => candidate.row.path.join(".") === path.join(".")
  );
  assert.ok(inspected, `no row for ${path.join(".")}`);

  return inspected;
}

function paths(
  inspection: ComponentInspection
): string[] {
  return inspection.rows.map(({ row }) => row.path.join("."));
}

describe("ComponentInspection", () => {
  test("shows the light fields of the light's kind", () => {
    const spot = paths(inspect("Light", { kind: "spot" }));
    const hemisphere = paths(inspect("Light", { kind: "hemisphere" }));

    assert.ok(spot.includes("angle") && spot.includes("castShadow"));
    assert.ok(!spot.includes("groundColor"));
    assert.ok(hemisphere.includes("groundColor"));
    assert.ok(!hemisphere.includes("castShadow"));
  });

  test("writes a top-level field as a one-field patch and unsets it when set back to its default", () => {
    const inspection = inspect("Light", { kind: "point", intensity: 3 });
    const intensity = rowAt(inspection, "intensity");

    assert.deepEqual(inspection.edit(intensity, 2), new ComponentChange({ data: { intensity: 2 } }));
    assert.deepEqual(
      inspection.edit(intensity, LIGHT_DEFAULTS.intensity),
      new ComponentChange({ unset: ["intensity"] })
    );
  });

  test("merges a nested field into the stored object, not the parsed defaults", () => {
    const inspection = inspect("Mesh", { geometry: { kind: "sphere", radius: 2 } });

    assert.deepEqual(
      inspection.edit(rowAt(inspection, "geometry", "widthSegments"), 8),
      new ComponentChange({ data: { geometry: { kind: "sphere", radius: 2, widthSegments: 8 } } })
    );
  });

  test("drops the previous geometry's fields when the geometry kind changes", () => {
    const inspection = inspect("Mesh", { geometry: { kind: "box", width: 3 } });

    assert.deepEqual(
      inspection.edit(rowAt(inspection, "geometry", "kind"), "torus"),
      new ComponentChange({ data: { geometry: { kind: "torus" } } })
    );
  });

  test("reads a nested field's default from its object's kind", () => {
    const radius = rowAt(
      inspect("Mesh", { geometry: { kind: "sphere", radius: 4 } }),
      "geometry",
      "radius"
    );

    assert.strictEqual(radius.value, 4);
    assert.strictEqual(radius.fallback, MESH_GEOMETRY_DEFAULTS.sphere.radius);
  });
});
