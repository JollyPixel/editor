// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CATALOG_CREATE,
  CATALOG_RENAME
} from "@jolly-pixel/asset-server/client";
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

  it("refuses to create or rename a blockset asset without the catalog right", async() => {
    const { catalog, blocksets } = setupMapBlocksets([TERRAIN_BLOCKSET]);
    let changes = 0;
    blocksets.on("change", () => changes++);

    catalog.refuse(CATALOG_CREATE, CATALOG_RENAME);
    const announced = changes;
    const created = await blocksets.create({
      name: "moss",
      tileSize: 16,
      cols: 4,
      rows: 4
    });
    await blocksets.rename("terrain", "grass");

    assert.equal(announced, 1);
    assert.equal(created, null);
    assert.equal(blocksets.creatable, false);
    assert.equal(blocksets.renamable("terrain"), false);
    assert.deepEqual(catalog.calls, []);
  });
});
