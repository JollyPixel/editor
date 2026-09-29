// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  blockCountsByTileset,
  tilesetTabLabels
} from "../../../src/features/texture/tilesetTabLabels.ts";
import { TilesetEntry } from "../../../src/features/tilesets/TilesetEntry.ts";

// CONSTANTS
const kDefinition = {
  id: "stone",
  asset: {
    id: "asset-stone",
    kind: "pixelart"
  },
  tileSize: 16
};
const kLinked = new TilesetEntry(kDefinition, "asset-stone", "stone");

function makeBlock(
  id: number,
  tilesetId: string
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    faceTextures: {},
    defaultTexture: { col: 0, row: 0, tilesetId },
    properties: {}
  };
}

describe("tilesetTabLabels", () => {
  it("shows the block count as the badge and spells it out in the tooltip", () => {
    assert.deepEqual(tilesetTabLabels(kLinked, 12), {
      name: "stone",
      tooltip: "stone · 16px · 12 blocks",
      badge: "12"
    });
  });

  it("uses the singular for one block and keeps a zero badge", () => {
    assert.equal(
      tilesetTabLabels(kLinked, 1).tooltip,
      "stone · 16px · 1 block"
    );
    assert.equal(tilesetTabLabels(kLinked, 0).badge, "0");
  });

  it("names an unlinked tileset in the tooltip", () => {
    const labels = tilesetTabLabels(
      new TilesetEntry(kDefinition, null, "stone"),
      0
    );

    assert.equal(labels.tooltip, "Unlinked texture · 16px · 0 blocks");
  });
});

describe("blockCountsByTileset", () => {
  it("counts each block once per tileset it uses", () => {
    const blocks = [
      makeBlock(1, "stone"),
      makeBlock(2, "stone"),
      makeBlock(3, "gone")
    ];

    assert.deepEqual(
      [...blockCountsByTileset(blocks)],
      [
        ["stone", 2],
        ["gone", 1]
      ]
    );
  });
});
