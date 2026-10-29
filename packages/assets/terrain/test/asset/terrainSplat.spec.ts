// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeSplat,
  terrainAssetKind
} from "#src/index.ts";
import {
  networkCommand,
  paint,
  splatTile
} from "../helpers/terrain.ts";

describe("terrain splat", () => {
  test("a splat patch keeps its valid tiles and answers the author with the refused ones' splat", async() => {
    const room = new LiveAssetRoom(terrainAssetKind());
    await room.connect("A");
    room.take("A");
    const unbalanced = splatTile(4);
    unbalanced.weights[0] = 200;
    const valid = paint(0, 0, { 2: 4 });
    const invalid = { x: 0, z: 0, tile: 1, splat: encodeSplat(unbalanced) };
    assert.ok(valid.action === "splat-patched");

    await room.receive("A", networkCommand({ action: "splat-patched", tiles: [...valid.tiles, invalid] }));

    const { splat } = room.state.terrain.chunk(new ChunkCoord(0, 0))!;
    assert.deepEqual([splat.dominantSlot(64, 0), splat.dominantSlot(32, 0)], [4, 0]);
    const [correction] = room.take("A").filter((message) => message.type === "correction");
    assert.ok(correction !== undefined && correction.data.action === "splat-patched");
    assert.deepEqual(correction.data.tiles.map(({ tile }) => tile), [1]);
  });
});
