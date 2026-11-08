// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/core/actor/Actor.ts";
import {
  shaderTextureSlot,
  type Shader,
  type ShaderUniformValues
} from "../../../src/three/assets/shader.ts";
import { MeshDefinition } from "../../../src/three/components/renderers/mesh/MeshDefinition.ts";
import { ComponentAssets } from "../../../src/core/systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../src/core/systems/scene/file/SceneFile.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";

interface MeshAssetsFixture {
  shader?: Shader;
  textures?: Readonly<Record<string, THREE.Texture>>;
}

function createMesh(
  data: JSONObject = {},
  fixture: MeshAssetsFixture = {}
) {
  const { world } = createSceneSetup();
  const actor = new Actor(world as any, { name: "mesh" });
  const definition = new MeshDefinition();
  const references: Record<string, AssetReferenceData> = {};
  const values = new Map<string, unknown>();
  if (fixture.shader !== undefined) {
    references.shader = { kind: "shader", id: "shader" };
    values.set("shader", fixture.shader);
  }
  for (const [uniform, texture] of Object.entries(fixture.textures ?? {})) {
    references[shaderTextureSlot(uniform)] = { kind: "texture", id: uniform };
    values.set(uniform, texture);
  }
  const component = definition.create(
    actor,
    definition.parse(data),
    {
      mode: "edit",
      assets: new ComponentAssets(definition.assets, references, {
        resolve: <TValue>(reference: AssetReferenceData): TValue | null => (
          values.get(reference.id) ?? null
        ) as TValue | null
      })
    }
  );

  return { actor, definition, component };
}

function recordingShader(
  uniforms: ShaderUniformValues = {}
) {
  const calls: ShaderUniformValues[] = [];
  const assigned: ShaderUniformValues[] = [];
  const material = new THREE.MeshBasicMaterial();
  const shader: Shader = {
    uniforms,
    createMaterial: (values = {}) => {
      calls.push(values);

      return {
        material,
        assign: (next) => assigned.push(next)
      };
    }
  };

  return { shader, calls, assigned, material };
}

function standardMaterial(
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>
): THREE.MeshStandardMaterial {
  const { material } = mesh;
  assert.ok(material instanceof THREE.MeshStandardMaterial);

  return material;
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
    assert.strictEqual(mesh.parent, actor.node.object3D);
    assert.ok(mesh.geometry instanceof THREE.SphereGeometry);
    assert.strictEqual(mesh.geometry.parameters.radius, 2);
    const material = standardMaterial(mesh);
    assert.strictEqual(material.color.getHexString(), "00ff00");
    assert.strictEqual(material.roughness, 0.25);
    assert.strictEqual(material.transparent, true);
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
      definition.parse(definition.capture(component, data)),
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
    assert.strictEqual(standardMaterial(component.threeMesh).metalness, 1);
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

describe("Components.MeshDefinition shader slot", () => {
  test("renders with a material built by the shader", () => {
    const { shader, material } = recordingShader();
    const { component } = createMesh({}, { shader });

    assert.strictEqual(component.threeMesh.material, material);
  });

  test("builds the material from the uniform data and slot textures, defaults for the rest", () => {
    const map = new THREE.Texture();
    const { shader, calls } = recordingShader({
      speed: 1,
      tint: new THREE.Color("#ffffff"),
      offset: new THREE.Vector3(1, 1, 1),
      scale: 2,
      map: new THREE.Texture()
    });

    createMesh({
      uniforms: {
        speed: 3,
        tint: "#ff0000",
        offset: { y: 2 },
        scale: "large"
      }
    }, { shader, textures: { map } });

    const [values] = calls;
    assert.deepEqual(Object.keys(values).sort(), ["map", "offset", "scale", "speed", "tint"]);
    assert.strictEqual(values.speed, 3);
    assert.strictEqual(values.scale, 2);
    assert.strictEqual((values.tint as THREE.Color).getHexString(), "ff0000");
    assert.deepEqual((values.offset as THREE.Vector3).toArray(), [1, 2, 1]);
    assert.strictEqual(values.map, map);
  });

  test("apply assigns the uniform data to the live material, defaults for missing values", () => {
    const { shader, calls, assigned, material } = recordingShader({
      speed: 1,
      map: new THREE.Texture()
    });
    const { definition, component } = createMesh({ uniforms: { speed: 3 } }, { shader });

    definition.apply(component, definition.parse({ castShadow: true }));

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(component.threeMesh.material, material);
    assert.strictEqual(component.threeMesh.castShadow, true);
    assert.deepEqual(assigned, [{ speed: 1 }]);
  });

  test("disposes the shader material with the component", () => {
    const { shader, material } = recordingShader();
    let disposed = false;
    material.addEventListener("dispose", () => {
      disposed = true;
    });
    const { component } = createMesh({}, { shader });

    component.destroy();

    assert.strictEqual(disposed, true);
  });
});
