// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { tilesetTabLabels } from "../../../src/features/texture/tilesetTabLabels.ts";
import type { TilesetEntry } from "../../../src/features/tilesets/tilesetEntry.ts";

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
      {
        ...kLinked,
        assetId: null
      },
      0
    );

    assert.equal(labels.tooltip, "Unlinked texture · 16px · 0 blocks");
  });
});
