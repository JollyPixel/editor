// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { encodeContent } from "@jolly-pixel/asset-server";
import { ModelFileDocument } from "@jolly-pixel/asset.model/client";

// Import Internal Dependencies
import { ModelFile } from "#src/file/ModelFile.ts";
import { ModelPreview } from "#src/preview/ModelPreview.ts";
import { cubeModelGlb } from "#src/seed/cubeModel.ts";

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

function modelPreview(
  path: string,
  bytes: Uint8Array | null
) {
  const document = new ModelFileDocument();
  if (bytes !== null) {
    document.load(encodeContent(bytes));
  }
  const session = {
    targetRecord: {
      id: "model-1",
      path
    },
    catalog: {
      replace(): never {
        throw new Error("ModelPreview never replaces the file.");
      }
    }
  };

  return {
    document,
    preview: new ModelPreview(new ModelFile(session, document))
  };
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

  test("keeps only the latest file when the source changes mid-load", async() => {
    const { document, preview } = modelPreview(
      "cube.glb",
      new TextEncoder().encode("not a model")
    );
    const statuses: string[] = [];
    preview.subscribe("change", () => statuses.push(preview.view.status));

    preview.follow();
    const loaded = settled(preview);
    document.load(encodeContent(cubeModelGlb()));
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
