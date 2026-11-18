// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VOXEL_BRUSH_PRESENCE_KEY } from "#src/network/voxelMap/brushPresence.ts";
import { UnknownBlockError } from "#src/golem/index.ts";
import {
  blocksetAdded,
  defineBlock,
  openField
} from "../helpers/golem.ts";

// CONSTANTS
const kGround = {
  min: {
    x: 0,
    y: 0,
    z: 0
  },
  max: {
    x: 3,
    y: 1,
    z: 2
  }
};

describe("VoxelMapAsset", () => {
  test("fills and clears boxes, with the golem's brush on the last cell", async() => {
    const { map, room } = await openField();

    assert.equal(await map.fillBox({ ...kGround, block: "stone", layer: "Ground" }), 24);
    assert.equal(await map.clearBox({
      min: { x: 0, y: 1, z: 0 },
      max: { x: 9, y: 9, z: 0 },
      layer: "Ground"
    }), 4);
    await map.settled();

    assert.equal((await map.summary()).voxelCount, 20);
    assert.deepEqual(map.heightmap({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 5, z: 1 }
    }).heights, [[0, 0], [1, 1]]);
    assert.deepEqual(map.query({
      min: { x: 3, y: 1, z: 2 },
      max: { x: 4, y: 1, z: 2 }
    }), {
      cells: [{ x: 3, y: 1, z: 2, block: 1, layer: "Ground" }],
      truncated: false
    });
    assert.deepEqual(room.presence, {
      [VOXEL_BRUSH_PRESENCE_KEY]: {
        position: { x: 3, y: 1, z: 0 },
        size: 1,
        pattern: "square"
      }
    });
  });

  test("names blocks across blocksets added after opening, and rejects an ambiguous name", async() => {
    const { studio, map } = await openField();
    const rocksId = await defineBlock(studio, "blocksets/rocks.blockset.json");
    await map.apply([blocksetAdded("rocks", 1, rocksId)]);
    await map.settled();

    await assert.rejects(
      map.fillBox({ ...kGround, block: "stone", layer: "Ground" }),
      (error: unknown) => error instanceof UnknownBlockError && error.candidates.length === 2
    );
    await assert.rejects(
      map.fillBox({ ...kGround, block: "rocks/stone", layer: "Sky" }),
      /no layer "Sky"/
    );
    await map.fillBox({ ...kGround, block: "rocks/stone", layer: "Ground" });
    await map.settled();

    assert.deepEqual(
      new Set(map.query(kGround).cells.map(({ block }) => block)),
      new Set([(await map.summary()).blocks.find(({ blockset }) => blockset === "rocks")?.id])
    );
  });

  test("relinks a blockset pointed at another asset", async() => {
    const { studio, map } = await openField();
    const rocksId = await defineBlock(studio, "blocksets/rocks.blockset.json", "stone");
    const gravelId = await defineBlock(studio, "blocksets/gravel.blockset.json", "gravel");
    await map.apply([blocksetAdded("rocks", 1, rocksId)]);
    await map.settled();
    await map.summary();

    await map.apply([
      {
        action: "blockset-removed",
        blocksetId: "rocks"
      },
      blocksetAdded("rocks", 1, gravelId)
    ]);
    await map.settled();
    await map.fillBox({ ...kGround, block: "rocks/gravel", layer: "Ground" });
    await map.settled();

    const { blocksets } = await map.summary();
    assert.deepEqual(
      blocksets.find(({ id }) => id === "rocks"),
      {
        id: "rocks",
        slot: 1,
        assetId: gravelId,
        linked: true
      }
    );
  });

  test("adds layers on top or right above another, numbering a taken name", async() => {
    const { map } = await openField();

    await map.addLayer({ name: "Sky" });
    const decor = await map.addLayer({ name: "Ground", above: "Ground" });
    await map.settled();

    assert.equal(decor.name, "Ground (1)");
    assert.deepEqual(
      (await map.summary()).layers.map(({ id, name }) => [id === decor.id, name]),
      [[false, "Sky"], [true, "Ground (1)"], [false, "Ground"]]
    );
  });
});
