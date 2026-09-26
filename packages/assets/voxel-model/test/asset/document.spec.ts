// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createBlockUv,
  createVoxelModelDocument,
  decodeVoxelModelDocument,
  encodeVoxelModelDocument,
  VOXEL_MODEL_DOCUMENT_VERSION
} from "#src/index.ts";

// CONSTANTS
const kTexture = {
  id: "model-texture",
  kind: "pixelart"
};

describe("createVoxelModelDocument", () => {
  test("starts with one root block named Block", () => {
    const document = createVoxelModelDocument({ texture: kTexture });

    assert.strictEqual(document.version, VOXEL_MODEL_DOCUMENT_VERSION);
    assert.strictEqual(document.nodes.length, 1);
    assert.partialDeepStrictEqual(document.nodes[0], {
      name: "Block",
      kind: "block",
      parentId: null,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        pivotOffset: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      },
      uv: createBlockUv()
    });
  });

  test("gives each block its own identity", () => {
    const [first, second] = createVoxelModelDocument({
      texture: kTexture,
      blocks: ["Head", "Torso"]
    }).nodes;

    assert.deepEqual(
      [first.name, second.name],
      ["Head", "Torso"]
    );
    assert.notStrictEqual(first.id, second.id);
  });

  test("creates an empty model when no block is asked for", () => {
    const document = createVoxelModelDocument({
      texture: kTexture,
      blocks: []
    });

    assert.deepEqual(document.nodes, []);
  });

  test("copies the texture reference it is given", () => {
    const document = createVoxelModelDocument({ texture: kTexture });

    assert.deepEqual(document.texture, kTexture);
    assert.notStrictEqual(document.texture, kTexture);
  });

  test("round-trips its blocks and texture reference", () => {
    const document = createVoxelModelDocument({ texture: kTexture });

    const decoded = decodeVoxelModelDocument(
      encodeVoxelModelDocument(document)
    );

    assert.deepEqual(decoded, document);
  });
});
