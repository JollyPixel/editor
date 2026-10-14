// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelDocument,
  type BlockRegistry
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockSelection } from "../../src/state/BlockSelection.ts";

function createBlocks(
  ids: number[]
): BlockRegistry {
  return new VoxelDocument({
    chunkSize: 4,
    layers: ["Ground"],
    blocks: ids.map((id) => {
      return {
        id,
        name: `Block ${id}`,
        shapeId: "cube",
        faceTextures: {},
        collidable: true,
        properties: {}
      };
    })
  }).blocks;
}

describe("BlockSelection", () => {
  test("starts with no block", () => {
    assert.strictEqual(new BlockSelection().id, null);
  });

  test("emits once per actual change", () => {
    const block = new BlockSelection();
    const changes: Array<number | null> = [];
    block.subscribe("change", (id) => changes.push(id));

    block.id = 4;
    block.id = 4;
    block.id = null;

    assert.deepStrictEqual(changes, [4, null]);
    assert.strictEqual(block.id, null);
  });

  test("resolves the selected block only while it is registered", () => {
    const blocks = createBlocks([3]);
    const block = new BlockSelection();

    assert.strictEqual(block.resolve(blocks), undefined);

    block.id = 3;
    assert.strictEqual(block.resolve(blocks)?.name, "Block 3");

    blocks.unregister(3);
    assert.strictEqual(block.resolve(blocks), undefined);
  });

  describe("reconcile", () => {
    test("stays empty while the registry has no block", () => {
      const block = new BlockSelection();

      block.reconcile(createBlocks([]));

      assert.strictEqual(block.id, null);
    });

    test("selects the first block once the registry fills", () => {
      const block = new BlockSelection();

      block.reconcile(createBlocks([7, 3]));

      assert.strictEqual(block.id, 7);
    });

    test("keeps a block that is still registered", () => {
      const block = new BlockSelection();
      block.id = 3;
      const changes: Array<number | null> = [];
      block.subscribe("change", (id) => changes.push(id));

      block.reconcile(createBlocks([7, 3]));

      assert.strictEqual(block.id, 3);
      assert.deepStrictEqual(changes, []);
    });

    test("falls back to the first block when the selected one is removed", () => {
      const blocks = createBlocks([7, 3]);
      const block = new BlockSelection();
      block.id = 3;

      blocks.unregister(3);
      block.reconcile(blocks);

      assert.strictEqual(block.id, 7);
    });

    test("clears the selection when the last block is removed", () => {
      const blocks = createBlocks([3]);
      const block = new BlockSelection();
      block.id = 3;

      blocks.unregister(3);
      block.reconcile(blocks);

      assert.strictEqual(block.id, null);
    });
  });
});
