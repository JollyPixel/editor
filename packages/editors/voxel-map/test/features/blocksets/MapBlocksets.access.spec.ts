// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  composeBlockId,
  MaterialGroup
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  ROCK_BLOCKSET,
  TERRAIN_BLOCKSET,
  setupMapBlocksets
} from "../../helpers/mapBlocksets.ts";

describe("MapBlocksets access", () => {
  it("refuses the writes a blockset room only lets its role read", () => {
    const { sources, blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET, ROCK_BLOCKSET]);
    let changes = 0;
    blocksets.on("change", () => changes++);

    sources.rooms.get("rock")!.sync({
      "block-defined": "read",
      "block-removed": "read",
      "block-moved": "read"
    });

    assert.equal(changes, 1);
    assert.equal(blocksets.access("rock").has("blocks"), false);
    assert.equal(blocksets.access("rock").has("materials"), true);
    assert.deepEqual(
      blocksets.entriesGranting("blocks").map((entry) => entry.id),
      ["terrain"]
    );
    assert.equal(blocksets.defineBlock({
      id: composeBlockId(2, 3),
      name: "moss",
      shapeId: "cube"
    }), false);
    assert.equal(blocksets.defineBlock({
      id: composeBlockId(1, 3),
      name: "grass",
      shapeId: "cube"
    }), true);
    assert.equal(blocksets.defineMaterialGroup(new MaterialGroup({ id: "rock/wet" })), true);
    assert.equal(blocksets.resizeTiles("rock", 32), true);
  });

  it("reports refused block-level commands, leaving pixel refusals to the texture", () => {
    const { sources, blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET, ROCK_BLOCKSET]);
    const denied: string[] = [];
    blocksets.on("denied", (blocksetId) => denied.push(blocksetId));
    const room = sources.rooms.get("rock")!;

    room.emit("denied", {
      event: "stroke",
      reason: "read-only"
    });
    room.emit("denied", {
      event: "material-group-defined",
      reason: "read-only"
    });

    assert.deepEqual(denied, ["rock"]);
  });
});
