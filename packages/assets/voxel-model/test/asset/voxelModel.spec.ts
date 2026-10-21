// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockTransform,
  BlockUvLayouts,
  createVoxelModelFile,
  decodeVoxelModelFile,
  encodeVoxelModelFile,
  VOXEL_MODEL_FILE_VERSION
} from "#src/index.ts";

// CONSTANTS
const kTexture = {
  id: "model-texture",
  kind: "pixelart"
};

describe("createVoxelModelFile", () => {
  test("starts with one root block named Block", () => {
    const file = createVoxelModelFile({ texture: kTexture });

    assert.strictEqual(file.version, VOXEL_MODEL_FILE_VERSION);
    assert.strictEqual(file.nodes.length, 1);
    assert.partialDeepStrictEqual(file.nodes[0], {
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
      uv: BlockUvLayouts.net()
    });
  });

  test("gives each block its own identity", () => {
    const [first, second] = createVoxelModelFile({
      texture: kTexture,
      blocks: ["Head", "Torso"]
    }).nodes;

    assert.deepEqual(
      [first.name, second.name],
      ["Head", "Torso"]
    );
    assert.notStrictEqual(first.id, second.id);
    assert.match(first.id, /^[0-9A-Za-z]{12}$/);
  });

  test("creates an empty model when no block is asked for", () => {
    const file = createVoxelModelFile({
      texture: kTexture,
      blocks: []
    });

    assert.deepEqual(file.nodes, []);
  });

  test("copies the texture reference it is given", () => {
    const file = createVoxelModelFile({ texture: kTexture });

    assert.deepEqual(file.texture, kTexture);
    assert.notStrictEqual(file.texture, kTexture);
  });

  test("round-trips its blocks and texture reference", () => {
    const file = createVoxelModelFile({ texture: kTexture });

    const decoded = decodeVoxelModelFile(
      encodeVoxelModelFile(file)
    );

    assert.deepEqual(decoded, file);
  });
});

describe("encodeVoxelModelFile", () => {
  test("stores only the transform parts and active faces that differ from the defaults", () => {
    const created = createVoxelModelFile({
      texture: kTexture,
      blocks: ["Head", "Torso"]
    });
    const [head, torso] = created.nodes;
    assert.ok(head.kind === "block" && torso.kind === "block");
    const file = {
      ...created,
      nodes: [
        {
          ...head,
          transform: BlockTransform.create({ position: { x: 0, y: 2, z: 0 } })
        },
        {
          ...torso,
          uv: {
            ...torso.uv,
            activeFaces: ["front" as const]
          }
        }
      ]
    };

    const content = encodeVoxelModelFile(file);
    const stored = JSON.parse(new TextDecoder().decode(content));

    assert.deepEqual(stored.nodes[0].transform, { position: { x: 0, y: 2, z: 0 } });
    assert.equal("activeFaces" in stored.nodes[0].uv, false);
    assert.deepEqual(stored.nodes[1].transform, {});
    assert.deepEqual(stored.nodes[1].uv.activeFaces, ["front"]);
    assert.deepEqual(decodeVoxelModelFile(content), file);
  });
});
