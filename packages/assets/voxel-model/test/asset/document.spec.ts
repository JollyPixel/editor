// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createVoxelModelDocument,
  decodeVoxelModelDocument,
  encodeVoxelModelDocument,
  VOXEL_MODEL_DOCUMENT_VERSION
} from "#src/index.ts";

describe("createVoxelModelDocument", () => {
  test("starts with one root block named Block", () => {
    const document = createVoxelModelDocument();

    assert.strictEqual(document.version, VOXEL_MODEL_DOCUMENT_VERSION);
    assert.strictEqual(document.nodes.length, 1);
    assert.partialDeepStrictEqual(document.nodes[0], {
      name: "Block",
      parentUuid: null,
      position: { x: 0, y: 0, z: 0 },
      pivotOffset: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 }
    });
    assert.deepEqual(document.folders, []);
    assert.deepEqual(document.placements, []);
  });

  test("gives each block its own identity", () => {
    const [first, second] = createVoxelModelDocument({
      blocks: ["Head", "Torso"]
    }).nodes;

    assert.deepEqual(
      [first.name, second.name],
      ["Head", "Torso"]
    );
    assert.notStrictEqual(first.uuid, second.uuid);
  });

  test("creates an empty model when no block is asked for", () => {
    const document = createVoxelModelDocument({ blocks: [] });

    assert.deepEqual(document.nodes, []);
    assert.strictEqual(document.texture, undefined);
  });

  test("round-trips its blocks and texture reference", () => {
    const document = createVoxelModelDocument({
      texture: {
        id: "model-texture",
        kind: "pixelart"
      }
    });

    const decoded = decodeVoxelModelDocument(
      encodeVoxelModelDocument(document)
    );

    assert.deepEqual(decoded, document);
  });
});
