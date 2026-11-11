// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  parseModel,
  type Model
} from "../../src/three/assets/index.ts";
import { spinningTriangleGlb } from "../helpers/model/glbFile.ts";
import {
  dataFiles,
  withDocument,
  withProgressEvents
} from "../helpers/model/loading.ts";

// CONSTANTS
const kRedTriangleObj = new TextEncoder().encode(
  "mtllib paint.mtl\nv 0 0 0\nv 1 0 0\nv 0 1 0\nusemtl red\nf 1 2 3\n"
);

function materialColor(
  model: Model
): number[] {
  const mesh = model.object.getObjectByProperty("type", "Mesh");
  assert.ok(mesh instanceof THREE.Mesh);
  assert.ok(mesh.material instanceof THREE.MeshPhongMaterial);

  return mesh.material.color.toArray();
}

describe("parseModel", () => {
  test("reads the meshes and animation clips of a .glb file", async() => {
    const model = await parseModel(spinningTriangleGlb(), "triangle.glb");

    const mesh = model.object.getObjectByName("triangle");
    assert.ok(mesh instanceof THREE.Mesh);
    assert.equal(mesh.geometry.getAttribute("position").count, 3);
    assert.deepEqual(
      model.animations.map((clip) => [clip.name, clip.duration]),
      [["spin", 1]]
    );
  });

  test("reads an .obj file without materials and names it after the file", async() => {
    const content = new TextEncoder().encode(
      "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n"
    );

    const model = await parseModel(content, "models/triangle.obj");

    const mesh = model.object.getObjectByProperty("type", "Mesh");
    assert.ok(mesh instanceof THREE.Mesh);
    assert.equal(mesh.geometry.getAttribute("position").count, 3);
    assert.equal(model.object.name, "triangle");
    assert.deepEqual(model.animations, []);
  });

  test("colors an .obj file with the materials of its mtllib libraries", async() => {
    const manager = dataFiles({
      "models/paint.mtl": "newmtl red\nKd 1 0 0\n"
    });

    const model = await withProgressEvents(
      () => parseModel(kRedTriangleObj, "triangle.obj", {
        resourcePath: "models/",
        manager
      })
    );

    assert.deepEqual(materialColor(model), [1, 0, 0]);
  });

  test("keeps the mtllib materials of an .obj file given a texture", async() => {
    const manager = dataFiles({
      "models/paint.mtl": "newmtl red\nKd 1 0 0\n"
    });

    const model = await withDocument(() => withProgressEvents(
      () => parseModel(kRedTriangleObj, "triangle.obj", {
        resourcePath: "models/",
        manager,
        texture: "triangle.png"
      })
    ));

    const mesh = model.object.getObjectByProperty("type", "Mesh");
    assert.ok(mesh instanceof THREE.Mesh);
    assert.equal(mesh.material.map, null);
    assert.deepEqual(materialColor(model), [1, 0, 0]);
  });

  test("keeps default materials when an .obj file's library fails to load", async() => {
    const model = await withProgressEvents(
      () => parseModel(kRedTriangleObj, "triangle.obj", {
        resourcePath: "models/",
        manager: dataFiles({})
      })
    );

    assert.deepEqual(materialColor(model), [1, 1, 1]);
  });

  test("rejects a file extension it has no loader for", async() => {
    await assert.rejects(
      parseModel(new Uint8Array(), "model.blend"),
      /Unsupported model type: \.blend/
    );
  });
});
