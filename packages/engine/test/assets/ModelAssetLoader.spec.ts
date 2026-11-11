// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  AssetCatalog,
  AssetRecord,
  type AssetLoadContext
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { ModelAssetLoader } from "../../src/three/assets/index.ts";
import {
  dataFiles,
  withDocument,
  withProgressEvents
} from "../helpers/model/loading.ts";

// CONSTANTS
const kPixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAA" +
  "AAYAAjCB0C8AAAAASUVORK5CYII=";
const kTexturedObj = "v 0 0 0\nv 1 0 0\nv 0 1 0\n" +
  "vt 0 0\nvt 1 0\nvt 0 1\nf 1/1 2/2 3/3\n";
const kMeshoptTriangle = "oAAAATwAAAD//wE8AAAAfn0AAAEMAAAA/wEMAAAAfg" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
const kMeshoptGltf = {
  asset: {
    version: "2.0"
  },
  extensionsUsed: ["EXT_meshopt_compression"],
  extensionsRequired: ["EXT_meshopt_compression"],
  buffers: [
    {
      uri: "triangle.bin",
      byteLength: 67
    },
    {
      byteLength: 36,
      extensions: {
        EXT_meshopt_compression: {
          fallback: true
        }
      }
    }
  ],
  bufferViews: [
    {
      buffer: 1,
      byteLength: 36,
      byteStride: 12,
      extensions: {
        EXT_meshopt_compression: {
          buffer: 0,
          byteLength: 67,
          byteStride: 12,
          count: 3,
          mode: "ATTRIBUTES"
        }
      }
    }
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: "VEC3",
      min: [0, 0, 0],
      max: [1, 1, 0]
    }
  ],
  meshes: [
    {
      primitives: [
        {
          attributes: {
            POSITION: 0
          }
        }
      ]
    }
  ],
  nodes: [
    {
      mesh: 0
    }
  ],
  scenes: [
    {
      nodes: [0]
    }
  ],
  scene: 0
};

function loadContext(
  records: AssetRecord[] = []
): AssetLoadContext {
  return {
    assets: {
      catalog: new AssetCatalog(records),
      load: () => Promise.reject(new Error("No dependency to load."))
    }
  };
}

function binaryRecord(
  path: string
): AssetRecord {
  return new AssetRecord({
    id: path,
    kind: "binary",
    path
  });
}

describe("ModelAssetLoader", () => {
  test("decodes a Meshopt-compressed glTF", async() => {
    const loader = new ModelAssetLoader(dataFiles({
      "models/triangle.gltf": JSON.stringify(kMeshoptGltf),
      "models/triangle.bin": atob(kMeshoptTriangle)
    }));

    const model = await withProgressEvents(() => loader.load(new AssetRecord({
      id: "model.triangle",
      kind: "model",
      path: "models/triangle.gltf"
    }), loadContext()));

    const mesh = model.object.getObjectByProperty("type", "Mesh");
    assert.ok(mesh instanceof THREE.Mesh);
    assert.deepEqual(
      Array.from(mesh.geometry.getAttribute("position").array),
      [0, 0, 0, 1, 0, 0, 0, 1, 0]
    );
  });

  test("paints an .obj file with the image of the same name beside it", async() => {
    const loader = new ModelAssetLoader(dataFiles({
      "models/sphere.obj": kTexturedObj,
      "models/sphere.png": atob(kPixelPng)
    }));
    const record = binaryRecord("models/sphere.obj");

    const model = await withDocument(() => withProgressEvents(
      () => loader.load(record, loadContext([
        record,
        binaryRecord("models/sphere.png")
      ]))
    ));

    const mesh = model.object.getObjectByProperty("type", "Mesh");
    assert.ok(mesh instanceof THREE.Mesh);
    assert.ok(mesh.material instanceof THREE.MeshPhongMaterial);
    const { map } = mesh.material;
    assert.ok(map instanceof THREE.Texture);
    assert.notEqual(map.image, null);
    assert.equal(map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(map.magFilter, THREE.NearestFilter);
  });
});
