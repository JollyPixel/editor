// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { parseModel } from "../../src/assets/index.ts";
import { spinningTriangleGlb } from "../helpers/model/glbFile.ts";

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

  test("rejects a file extension it has no loader for", async() => {
    await assert.rejects(
      parseModel(new Uint8Array(), "model.blend"),
      /Unsupported model type: \.blend/
    );
  });
});
