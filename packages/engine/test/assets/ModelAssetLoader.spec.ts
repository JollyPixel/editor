// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { ModelAssetLoader } from "../../src/assets/index.ts";

// CONSTANTS
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

class FakeProgressEvent extends Event {
  readonly lengthComputable = false;
  readonly loaded = 0;
  readonly total = 0;
}

function createManager(): THREE.LoadingManager {
  const files = new Map([
    [
      "models/triangle.gltf",
      `data:model/gltf+json;base64,${btoa(JSON.stringify(kMeshoptGltf))}`
    ],
    [
      "models/triangle.bin",
      `data:application/octet-stream;base64,${kMeshoptTriangle}`
    ]
  ]);

  return new THREE.LoadingManager().setURLModifier(
    (url) => files.get(url.replace("/./", "/")) ?? url
  );
}

describe("ModelAssetLoader", () => {
  test("decodes a Meshopt-compressed glTF", async() => {
    const loader = new ModelAssetLoader(createManager());
    const previous = globalThis.ProgressEvent;
    globalThis.ProgressEvent = FakeProgressEvent;

    let model: Awaited<ReturnType<ModelAssetLoader["load"]>>;
    try {
      model = await loader.load(new AssetRecord({
        id: "model.triangle",
        kind: "model",
        source: "models/triangle.gltf"
      }));
    }
    finally {
      globalThis.ProgressEvent = previous;
    }

    const mesh = model.object.getObjectByProperty("type", "Mesh");
    assert.ok(mesh instanceof THREE.Mesh);
    assert.deepEqual(
      Array.from(mesh.geometry.getAttribute("position").array),
      [0, 0, 0, 1, 0, 0, 0, 1, 0]
    );
  });
});
