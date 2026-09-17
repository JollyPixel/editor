// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BLOCK_LIBRARY_ORDERS,
  isReorderable,
  orderBlocks,
  parseBlockLibraryOrder
} from "../../../src/features/blocks/blockLibraryOrder.ts";
import { choiceOf } from "../../../src/shared/toolChoice.ts";

function block(
  id: number
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block ${id}`,
    shapeId: "cube",
    faceTextures: {},
    collidable: true,
    properties: {}
  };
}

describe("blockLibraryOrder", () => {
  it("offers every order with a distinct value and icon", () => {
    const values = BLOCK_LIBRARY_ORDERS.map((option) => option.value);
    const icons = BLOCK_LIBRARY_ORDERS.map((option) => option.icon);

    assert.deepEqual(values, ["registry", "usage"]);
    assert.equal(new Set(icons).size, icons.length);
  });

  it("parses a stored order and falls back to the registry order", () => {
    assert.equal(parseBlockLibraryOrder("usage"), "usage");
    assert.equal(parseBlockLibraryOrder("registry"), "registry");
    assert.equal(parseBlockLibraryOrder("true"), "registry");
    assert.equal(parseBlockLibraryOrder(null), "registry");
  });

  it("only lets the registry order be reordered by dragging", () => {
    assert.equal(isReorderable("registry"), true);
    assert.equal(isReorderable("usage"), false);
  });

  it("keeps the registry array as is and sorts by usage on demand", () => {
    const blocks = [block(1), block(2), block(3)];
    const counts = new Map([[3, 4], [2, 1]]);

    assert.equal(orderBlocks(blocks, "registry", counts), blocks);
    assert.deepEqual(
      orderBlocks(blocks, "usage", counts).map(({ id }) => id),
      [3, 2, 1]
    );
  });

  it("shows the current order in the picker and offers the others", () => {
    const { active, alternatives } = choiceOf(BLOCK_LIBRARY_ORDERS, "usage");

    assert.equal(active.value, "usage");
    assert.deepEqual(alternatives.map(({ value }) => value), ["registry"]);
  });
});
