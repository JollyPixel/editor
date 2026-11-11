// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ModelFileDocument } from "@jolly-pixel/asset.model/client";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ModelFile } from "#src/file/ModelFile.ts";
import { ModelPreview } from "#src/preview/ModelPreview.ts";
import { cubeModelGlb } from "#src/seed/cubeModel.ts";
import { FakeModelCatalog } from "../helpers/file/FakeModelCatalog.ts";
import { stubDocument } from "../helpers/document.ts";
import { stubProgressEvents } from "../helpers/progressEvents.ts";

// CONSTANTS
const kExternalBufferGltf = new TextEncoder().encode(JSON.stringify({
  asset: {
    version: "2.0"
  },
  buffers: [
    {
      uri: "triangle.bin",
      byteLength: 36
    }
  ],
  bufferViews: [
    {
      buffer: 0,
      byteLength: 36
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
}));

const kTriangleBuffer = new Uint8Array(
  new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer
);
const kTexturedObj = new TextEncoder().encode(
  "v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nf 1/1 2/2 3/3\n"
);

function modelPreview(
  path: string,
  bytes: Uint8Array | null,
  catalog = new FakeModelCatalog()
) {
  const document = new ModelFileDocument();
  if (bytes !== null) {
    document.load(bytes);
  }
  const session = {
    targetRecord: {
      id: "model-1",
      path
    },
    catalog
  };

  return {
    document,
    preview: new ModelPreview(new ModelFile(session, document), catalog)
  };
}

function positions(
  preview: ModelPreview
): number[] {
  const mesh = preview.model?.object.getObjectByProperty("type", "Mesh");
  assert.ok(mesh instanceof THREE.Mesh);

  return Array.from(mesh.geometry.getAttribute("position").array);
}

function textureMap(
  preview: ModelPreview
): THREE.Texture | null {
  const mesh = preview.model?.object.getObjectByProperty("type", "Mesh");
  assert.ok(mesh instanceof THREE.Mesh);
  assert.ok(mesh.material instanceof THREE.MeshPhongMaterial);

  return mesh.material.map;
}

function settled(
  preview: ModelPreview
): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = preview.subscribe("change", () => {
      if (preview.view.status !== "loading") {
        unsubscribe();
        resolve();
      }
    });
  });
}

describe("ModelPreview", () => {
  stubProgressEvents();
  stubDocument();

  test("reads the seeded cube with its two clips", async() => {
    const { preview } = modelPreview("models/cube.glb", cubeModelGlb());

    const loaded = settled(preview);
    preview.follow();
    await loaded;

    const { view } = preview;
    assert.equal(view.status, "ready");
    assert.deepEqual(
      view.model.animations.map((clip) => [clip.name, clip.duration]),
      [["spin", 2], ["bounce", 1]]
    );
    assert.deepEqual({ ...view.stats }, {
      meshes: 1,
      vertices: 24,
      triangles: 12,
      materials: 1,
      bones: 0,
      clips: 2
    });
  });

  test("reports a file it cannot read", async() => {
    const { preview } = modelPreview(
      "broken.glb",
      new TextEncoder().encode("not a model")
    );

    const loaded = settled(preview);
    preview.follow();
    await loaded;

    assert.equal(preview.view.status, "failed");
    assert.equal(preview.model, null);
  });

  test("names the external buffer a .gltf file needs", async() => {
    const { preview } = modelPreview("models/triangle.gltf", kExternalBufferGltf);

    const loaded = settled(preview);
    preview.follow();
    await loaded;

    const { view } = preview;
    assert.equal(view.status, "failed");
    assert.match(view.error, /"triangle\.bin"/);
    assert.deepEqual(view.missing, ["triangle.bin"]);
  });

  test("reads a .gltf file's external buffer from the asset beside it", async() => {
    const catalog = new FakeModelCatalog()
      .add("models/triangle.bin", kTriangleBuffer);
    const { preview } = modelPreview(
      "models/triangle.gltf",
      kExternalBufferGltf,
      catalog
    );

    const loaded = settled(preview);
    preview.follow();
    await loaded;

    assert.equal(preview.view.status, "ready");
    assert.deepEqual(positions(preview), [0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  test("reloads when the missing buffer is added beside the model", async() => {
    const catalog = new FakeModelCatalog();
    const { preview } = modelPreview(
      "models/triangle.gltf",
      kExternalBufferGltf,
      catalog
    );
    const failed = settled(preview);
    preview.follow();
    await failed;

    const reloaded = settled(preview);
    catalog.add("models/triangle.bin", kTriangleBuffer);
    await reloaded;

    assert.equal(preview.view.status, "ready");
    assert.deepEqual(positions(preview), [0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  test("paints an .obj model once its image lands beside it", async() => {
    const catalog = new FakeModelCatalog();
    const { preview } = modelPreview("models/sphere.obj", kTexturedObj, catalog);
    const loaded = settled(preview);
    preview.follow();
    await loaded;
    const untextured = textureMap(preview);

    const reloaded = settled(preview);
    catalog.add("models/sphere.png", new Uint8Array([7]));
    await reloaded;

    assert.equal(untextured, null);
    assert.equal(preview.view.status, "ready");
    assert.ok(textureMap(preview) instanceof THREE.Texture);
  });

  test("keeps only the latest file when the source changes mid-load", async() => {
    const { document, preview } = modelPreview(
      "cube.glb",
      new TextEncoder().encode("not a model")
    );
    const statuses: string[] = [];
    preview.subscribe("change", () => statuses.push(preview.view.status));

    preview.follow();
    const loaded = settled(preview);
    document.load(cubeModelGlb());
    await loaded;

    assert.equal(preview.view.status, "ready");
    assert.deepEqual(statuses, ["loading", "loading", "ready"]);
  });

  test("shows nothing for an empty file", () => {
    const { preview } = modelPreview("cube.glb", null);

    preview.follow();

    assert.deepEqual([preview.view.status, preview.model], ["empty", null]);
  });
});
