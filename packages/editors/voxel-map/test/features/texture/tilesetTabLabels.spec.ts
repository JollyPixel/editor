// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { tilesetTabLabels } from "../../../src/features/texture/tilesetTabLabels.ts";
import type { TilesetEntry } from "../../../src/state/index.ts";

// CONSTANTS
const kLinked: TilesetEntry = {
  definition: {
    id: "stone",
    asset: {
      id: "asset-stone",
      kind: "pixelart"
    },
    tileSize: 16
  },
  assetId: "asset-stone",
  label: "stone"
};

describe("tilesetTabLabels", () => {
  it("shows the block count as the badge and spells it out in the tooltip", () => {
    assert.deepEqual(tilesetTabLabels(kLinked, { blocks: 12 }), {
      name: "stone",
      tooltip: "stone · 16px · 12 blocks",
      badge: "12"
    });
  });

  it("uses the singular for one block and keeps a zero badge", () => {
    assert.equal(
      tilesetTabLabels(kLinked, { blocks: 1 }).tooltip,
      "stone · 16px · 1 block"
    );
    assert.equal(tilesetTabLabels(kLinked, { blocks: 0 }).badge, "0");
  });

  it("suffixes a detached tab without touching the tooltip", () => {
    const labels = tilesetTabLabels(kLinked, {
      blocks: 3,
      detached: true
    });

    assert.equal(labels.name, "stone (detached)");
    assert.equal(labels.tooltip, "stone · 16px · 3 blocks");
  });

  it("names an unlinked tileset in the tooltip", () => {
    const labels = tilesetTabLabels(
      {
        ...kLinked,
        assetId: null
      },
      { blocks: 0 }
    );

    assert.equal(labels.tooltip, "Unlinked texture · 16px · 0 blocks");
  });
});
