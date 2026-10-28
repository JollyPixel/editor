// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { MeshDefinition } from "../../../src/components/renderers/mesh/MeshDefinition.ts";
import type { JSONObject } from "../../../src/systems/scene/file/SceneFile.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";

function createMesh(
  data: JSONObject = {}
) {
  const { world } = createSceneSetup();
  const actor = new Actor(world as any, { name: "mesh" });
  const definition = new MeshDefinition();
  const component = definition.create(
    actor,
    definition.parse(data)
  );

  return { actor, definition, component };
}

describe("Components.MeshDefinition", () => {
  test("parses an unknown geometry kind to a unit box", () => {
    const definition = new MeshDefinition();

    assert.deepEqual(definition.parse({ geometry: { kind: "teapot" } }).geometry, {
      kind: "box",
      width: 1,
      height: 1,
      depth: 1,
      widthSegments: 1,
      heightSegments: 1,
      depthSegments: 1
    });
  });

  test("creates a mesh from the geometry and material data", () => {
    const { actor, component } = createMesh({
      geometry: { kind: "sphere", radius: 2 },
      material: { color: "#00ff00", roughness: 0.25, opacity: 0.5 },
      castShadow: true
    });

    const mesh = component.threeMesh;
    assert.strictEqual(mesh.parent, actor.object3D);
    assert.ok(mesh.geometry instanceof THREE.SphereGeometry);
    assert.strictEqual(mesh.geometry.parameters.radius, 2);
    assert.strictEqual(mesh.material.color.getHexString(), "00ff00");
    assert.strictEqual(mesh.material.roughness, 0.25);
    assert.strictEqual(mesh.material.transparent, true);
    assert.strictEqual(mesh.castShadow, true);
    assert.strictEqual(mesh.receiveShadow, false);
  });

  test("captures a live mesh as the data it was built from", () => {
    const data = {
      geometry: { kind: "cylinder", radiusTop: 0.5, height: 3 },
      material: { color: "#00ff00", emissive: "#112233", opacity: 0.5 },
      receiveShadow: true
    };
    const { definition, component } = createMesh(data);

    assert.deepEqual(
      definition.parse(definition.capture(component)),
      definition.parse(data)
    );
  });

  test("apply keeps the geometry when only the material changes", () => {
    const { definition, component } = createMesh({ geometry: { kind: "torus" } });
    const geometry = component.threeMesh.geometry;

    definition.apply(component, definition.parse({
      geometry: { kind: "torus" },
      material: { metalness: 1 }
    }));

    assert.strictEqual(component.threeMesh.geometry, geometry);
    assert.strictEqual(component.threeMesh.material.metalness, 1);
  });

  test("apply rebuilds the geometry when its parameters change", () => {
    const { definition, component } = createMesh({ geometry: { kind: "box" } });
    const previous = component.threeMesh.geometry;
    let disposed = false;
    previous.addEventListener("dispose", () => {
      disposed = true;
    });

    definition.apply(component, definition.parse({ geometry: { kind: "box", width: 4 } }));

    const geometry = component.threeMesh.geometry;
    assert.ok(geometry instanceof THREE.BoxGeometry);
    assert.notStrictEqual(geometry, previous);
    assert.strictEqual(geometry.parameters.width, 4);
    assert.strictEqual(disposed, true);
  });
});
