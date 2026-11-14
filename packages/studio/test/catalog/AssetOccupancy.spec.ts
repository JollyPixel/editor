// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetOccupancy } from "../../src/catalog/AssetOccupancy.ts";

function peer(
  displayName: string
): PresencePeer {
  return {
    clientId: displayName.toLowerCase(),
    displayName,
    color: `var(--${displayName.toLowerCase()})`
  };
}

describe("AssetOccupancy", () => {
  test("badges three occupants at most, faded where the asset is not focused", () => {
    const occupancy = new AssetOccupancy([
      [peer("Dan"), { open: ["map-1"], focused: null }],
      [peer("Alice"), { open: [], focused: "map-1" }],
      [peer("Cid"), { open: ["map-1"], focused: null }],
      [peer("Bob"), { open: ["map-1"], focused: null }]
    ]);

    assert.deepEqual(occupancy.badges("map-1"), [
      {
        color: "var(--alice)",
        title: "Alice · Editing"
      },
      {
        color: "color-mix(in oklab, var(--bob) 40%, transparent)",
        title: "Bob · Open"
      },
      {
        color: "color-mix(in oklab, var(--cid) 40%, transparent)",
        title: "Cid · Open"
      }
    ]);
    assert.deepEqual(occupancy.badges("model-1"), []);
  });

  test("warns before a removal with the name of each occupant, once", () => {
    const occupancy = new AssetOccupancy([
      [peer("Eve"), { open: ["map-1"], focused: null }],
      [peer("Bob"), { open: ["map-1"], focused: null }],
      [peer("Alice"), { open: ["map-1", "blockset-1"], focused: "blockset-1" }],
      [peer("Dan"), { open: ["map-1"], focused: null }],
      [peer("Cid"), { open: ["texture-1"], focused: null }]
    ]);

    assert.deepEqual(
      [
        occupancy.removalWarning(["model-1"]),
        occupancy.removalWarning(["texture-1"]),
        occupancy.removalWarning(["blockset-1", "texture-1"]),
        occupancy.removalWarning(["map-1", "blockset-1"]),
        occupancy.removalWarning(["map-1", "texture-1"])
      ],
      [
        null,
        "Cid has it open: their editor will close.",
        "Alice and Cid have some of them open: their editor will close.",
        "Alice, Bob, Dan and 1 other have some of them open: their editor will close.",
        "Alice, Bob, Cid and 2 others have some of them open: their editor will close."
      ]
    );
  });
});
