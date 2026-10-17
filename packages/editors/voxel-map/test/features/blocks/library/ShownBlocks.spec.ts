// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { ShownBlocks } from "../../../../src/features/blocks/library/ShownBlocks.ts";

function block(
  id: number,
  name: string
): ResolvedBlockDefinition {
  return {
    id,
    name,
    shapeId: "cube",
    faceTextures: {},
    collidable: true,
    properties: {}
  };
}

function names(
  blocks: readonly ResolvedBlockDefinition[]
): string[] {
  return blocks.map(({ name }) => name);
}

function drop(
  shown: ShownBlocks,
  moved: ResolvedBlockDefinition,
  toIndex: number
): ResolvedBlockDefinition[] {
  const index = shown.registryIndex({ id: moved.id, toIndex });
  const next = shown.registry.filter((block) => block !== moved);
  next.splice(index, 0, moved);

  return next;
}

describe("ShownBlocks", () => {
  const registry = [
    block(1, "stone 1"),
    block(2, "wood 1"),
    block(3, "stone 2"),
    block(4, "wood 2"),
    block(5, "stone 3")
  ];
  const stones = new ShownBlocks(
    registry,
    registry.filter(({ name }) => name.startsWith("stone"))
  );

  it("keeps the drop index when every block is shown", () => {
    const shown = new ShownBlocks(registry, [...registry]);

    assert.equal(shown.registryIndex({ id: 1, toIndex: 3 }), 3);
    assert.equal(shown.registryIndex({ id: 1, toIndex: 4 }), 4);
  });

  it("drops a shown block before the block it lands on in the registry", () => {
    assert.deepEqual(
      names(drop(stones, registry[4], 0)),
      ["stone 3", "stone 1", "wood 1", "stone 2", "wood 2"]
    );
  });

  it("drops a shown block right after the last shown block", () => {
    assert.deepEqual(
      names(drop(stones, registry[0], 2)),
      ["wood 1", "stone 2", "wood 2", "stone 3", "stone 1"]
    );
  });

  it("drops a shown block between two others it shows", () => {
    assert.deepEqual(
      names(drop(stones, registry[0], 1)),
      ["wood 1", "stone 2", "wood 2", "stone 1", "stone 3"]
    );
  });

  it("maps drops onto a registry reordered behind hidden blocks", () => {
    const reordered = [
      registry[1],
      registry[3],
      registry[0],
      registry[2],
      registry[4]
    ];
    const next = stones.update(
      reordered,
      [registry[0], registry[2], registry[4]]
    );

    assert.equal(next.blocks, stones.blocks);
    assert.deepEqual(
      names(drop(next, registry[4], 0)),
      ["wood 1", "wood 2", "stone 3", "stone 1", "stone 2"]
    );
  });

  it("stays the same when neither the registry nor the shown blocks change", () => {
    assert.equal(stones.update(registry, [...stones.blocks]), stones);
  });
});
