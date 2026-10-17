// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { blocksetTabLabels } from "../../../src/features/texture/blocksetTabLabels.ts";
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

describe("blocksetTabLabels", () => {
  it("gives the tile size in the tooltip, after the name of the tab", () => {
    assert.deepEqual(
      blocksetTabLabels(new BlocksetEntry(kDefinition, "asset-stone", "stone")),
      {
        name: "stone",
        tooltip: "16px tiles"
      }
    );
  });

  it("flags an unlinked blockset in the tooltip", () => {
    const labels = blocksetTabLabels(
      new BlocksetEntry(kDefinition, null, "stone")
    );

    assert.equal(labels.tooltip, "Unlinked texture · 16px tiles");
  });
});
