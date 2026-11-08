// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  LIGHT_DEFAULTS,
  MESH_GEOMETRY_DEFAULTS,
  type Shader
} from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";
import {
  ComponentChange,
  type JSONObject,
  type SceneComponentJSON
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import {
  ComponentInspection,
  type InspectedField,
  type InspectedList,
  type InspectedRow
} from "../../src/components/ComponentInspection.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

// CONSTANTS
const kComponents = createSceneComponents();
const kUnitBoxCollider = {
  shape: {
    type: "box",
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 }
  },
  offset: { x: 0, y: 0, z: 0 },
  friction: 0.5,
  restitution: 0,
  density: 1,
  sensor: false
};

function inspect(
  type: string,
  data: JSONObject,
  shader: Pick<Shader, "uniforms"> | null = null
): ComponentInspection {
  const kind = kComponents.find(type);
  assert.ok(kind, `no component kind ${type}`);
  const shaderReference: AssetReferenceData = { kind: "shader", id: "shader" };
  const entry: SceneComponentJSON = {
    id: "component",
    type,
    data,
    assets: shader === null ? {} : { shader: shaderReference }
  };

  return new ComponentInspection(entry, kind, {
    resolve: <TValue>(): TValue | null => shader as TValue | null
  });
}

function find(
  inspection: ComponentInspection,
  path: string[]
): InspectedRow {
  const inspected = inspection.rows.find(
    (candidate) => rowKey(candidate) === path.join(".")
  );
  assert.ok(inspected, `no row for ${path.join(".")}`);

  return inspected;
}

function rowAt(
  inspection: ComponentInspection,
  ...path: string[]
): InspectedField {
  const inspected = find(inspection, path);
  assert.ok(inspected.kind === "field", `${path.join(".")} is a list`);

  return inspected;
}

function listAt(
  inspection: ComponentInspection,
  key: string
): InspectedList {
  const inspected = find(inspection, [key]);
  assert.ok(inspected.kind === "list", `${key} is not a list`);

  return inspected;
}

function itemRow(
  list: InspectedList,
  index: number,
  ...path: string[]
): InspectedField {
  const inspected = list.items[index]?.find(
    (candidate) => candidate.row.path.join(".") === path.join(".")
  );
  assert.ok(inspected, `no item row for ${path.join(".")}`);

  return inspected;
}

function paths(
  inspection: ComponentInspection
): string[] {
  return inspection.rows.map(rowKey);
}

function rowKey(
  inspected: InspectedRow
): string {
  return inspected.kind === "asset" ?
    inspected.row.slot :
    inspected.row.path.join(".");
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

  test("writes the whole list back when a nested field of an item changes", () => {
    const inspection = inspect("RigidBody", {});
    const colliders = listAt(inspection, "colliders");
    const halfExtents = itemRow(colliders, 0, "shape", "halfExtents");

    assert.deepEqual(halfExtents.value, { x: 0.5, y: 0.5, z: 0.5 });
    assert.deepEqual(
      inspection.editItem(colliders, 0, halfExtents, { x: 2, y: 0.5, z: 0.5 }),
      new ComponentChange({
        data: {
          colliders: [
            {
              ...kUnitBoxCollider,
              shape: {
                type: "box",
                halfExtents: { x: 2, y: 0.5, z: 0.5 }
              }
            }
          ]
        }
      })
    );
  });

  test("drops the previous shape's fields when an item's shape type changes", () => {
    const inspection = inspect("RigidBody", { colliders: [kUnitBoxCollider] });
    const colliders = listAt(inspection, "colliders");

    const change = inspection.editItem(
      colliders,
      0,
      itemRow(colliders, 0, "shape", "type"),
      "sphere"
    );
    const sphere = listAt(inspect("RigidBody", change.applyTo({})), "colliders");

    assert.deepEqual(change.data.colliders, [
      {
        ...kUnitBoxCollider,
        shape: { type: "sphere" }
      }
    ]);
    assert.strictEqual(itemRow(sphere, 0, "shape", "radius").value, 0.5);
  });

  test("reads an item field's default from that item's shape type", () => {
    const colliders = listAt(inspect("RigidBody", {
      colliders: [
        kUnitBoxCollider,
        {
          shape: {
            type: "capsule",
            halfHeight: 2,
            radius: 1
          }
        }
      ]
    }), "colliders");
    const halfHeight = itemRow(colliders, 1, "shape", "halfHeight");

    assert.strictEqual(halfHeight.value, 2);
    assert.strictEqual(halfHeight.fallback, 0.5);
    assert.deepEqual(
      itemRow(colliders, 0, "shape", "halfExtents").fallback,
      kUnitBoxCollider.shape.halfExtents
    );
  });

  test("appends the seed and removes an item by its position", () => {
    const sensor = {
      ...kUnitBoxCollider,
      sensor: true
    };
    const inspection = inspect("RigidBody", { colliders: [kUnitBoxCollider, sensor] });
    const colliders = listAt(inspection, "colliders");

    assert.deepEqual(
      inspection.addItem(colliders).data.colliders,
      [kUnitBoxCollider, sensor, kUnitBoxCollider]
    );
    assert.deepEqual(inspection.removeItem(colliders, 0).data.colliders, [sensor]);
  });
});

describe("ComponentInspection with a shaded mesh", () => {
  const kShader: Pick<Shader, "uniforms"> = {
    uniforms: {
      speed: 1,
      tint: new THREE.Color("#2f6fd6"),
      map: new THREE.Texture()
    }
  };

  test("swaps the material rows for the shader's uniforms and texture slots", () => {
    assert.deepEqual(paths(inspect("Mesh", {}, kShader)), [
      "geometry.kind",
      "geometry.width",
      "geometry.height",
      "geometry.depth",
      "geometry.widthSegments",
      "geometry.heightSegments",
      "geometry.depthSegments",
      "castShadow",
      "receiveShadow",
      "uniforms.speed",
      "uniforms.tint",
      "texture:map"
    ]);
  });

  test("shows a uniform's declared default until the data sets it", () => {
    const unset = rowAt(inspect("Mesh", {}, kShader), "uniforms", "tint");
    const set = rowAt(inspect("Mesh", { uniforms: { tint: "#ff0000" } }, kShader), "uniforms", "tint");

    assert.deepEqual([unset.value, unset.fallback], ["#2f6fd6", "#2f6fd6"]);
    assert.strictEqual(set.value, "#ff0000");
  });

  test("writes a uniform into the stored uniforms object", () => {
    const inspection = inspect("Mesh", { uniforms: { tint: "#ff0000" } }, kShader);

    assert.deepEqual(
      inspection.edit(rowAt(inspection, "uniforms", "speed"), 3),
      new ComponentChange({ data: { uniforms: { tint: "#ff0000", speed: 3 } } })
    );
  });
});
