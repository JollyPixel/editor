// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  blockCountsByBlockset,
  blocksetTabLabels
} from "../../../src/features/texture/blocksetTabLabels.ts";
import { BlocksetEntry } from "../../../src/features/blocksets/BlocksetEntry.ts";

// CONSTANTS
const kDefinition = {
  id: "stone",
  asset: {
    id: "asset-stone",
    kind: "pixelart"
  },
  tileSize: 16
};
const kLinked = new BlocksetEntry(kDefinition, "asset-stone", "stone");

function makeBlock(
  id: number,
  blocksetId: string
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    faceTextures: {},
    defaultTexture: { col: 0, row: 0, blocksetId },
    properties: {}
  };
}

describe("blocksetTabLabels", () => {
  it("shows the block count as the badge and spells it out in the tooltip", () => {
    assert.deepEqual(blocksetTabLabels(kLinked, 12), {
      name: "stone",
      tooltip: "stone · 16px · 12 blocks",
      badge: "12"
    });
  });

  it("uses the singular for one block and keeps a zero badge", () => {
    assert.equal(
      blocksetTabLabels(kLinked, 1).tooltip,
      "stone · 16px · 1 block"
    );
    assert.equal(blocksetTabLabels(kLinked, 0).badge, "0");
  });

  it("names an unlinked blockset in the tooltip", () => {
    const labels = blocksetTabLabels(
      new BlocksetEntry(kDefinition, null, "stone"),
      0
    );

    assert.equal(labels.tooltip, "Unlinked texture · 16px · 0 blocks");
  });
});

describe("blockCountsByBlockset", () => {
  it("counts each block once per blockset it uses", () => {
    const blocks = [
      makeBlock(1, "stone"),
      makeBlock(2, "stone"),
      makeBlock(3, "gone")
    ];

    assert.deepEqual(
      [...blockCountsByBlockset(blocks)],
      [
        ["stone", 2],
        ["gone", 1]
      ]
    );
  });
});
