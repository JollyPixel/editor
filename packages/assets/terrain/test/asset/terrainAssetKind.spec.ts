// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeHeights,
  encodeTerrainFile,
  MAX_TERRAIN_CHUNKS,
  terrainAssetKind,
  terrainSnapshot,
  TERRAIN_FILE_VERSION
} from "#src/index.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

function liveRoom() {
  return new LiveAssetRoom(terrainAssetKind());
}

function chunkKeys(
  room: ReturnType<typeof liveRoom>
): string[] {
  return [...room.state.chunks()].map(({ coord }) => coord.key).sort();
}

describe("terrain asset kind", () => {
  test("a new terrain holds one flat chunk at the origin", () => {
    const terrain = terrainAssetKind().create("asset");

    assert.deepEqual([...terrain.chunks()].map(({ coord }) => coord.key), ["0,0"]);
    assert.ok(terrain.chunk(new ChunkCoord(0, 0))!.copyHeights().every((height) => height === 0));
  });

  test("serialize and load round-trip the chunks and their heights", async() => {
    const handler = terrainAssetKind();
    const room = new LiveAssetRoom(handler);
    room.receive("A", networkCommand({ action: "chunk-added", x: 1, z: 0, heights: heights(12.5) }));

    const loaded = handler.create("copy");
    handler.load(loaded, await handler.serialize(room.state));

    assert.deepEqual(terrainSnapshot(loaded), terrainSnapshot(room.state));
  });

  test("load rejects a file with invalid heights", () => {
    const handler = terrainAssetKind();
    const content = encodeTerrainFile({
      version: TERRAIN_FILE_VERSION,
      chunks: [{ x: 0, z: 0, heights: "AAAA" }]
    });

    assert.throws(() => handler.load(handler.create("asset"), content), InvalidAssetFileError);
  });

  test("a chunk is admitted only next to an existing one", () => {
    const room = liveRoom();
    room.receive("A", networkCommand({ action: "chunk-added", x: 2, z: 0, heights: heights(0) }));
    room.receive("A", networkCommand({ action: "chunk-added", x: 1, z: 1, heights: heights(0) }));
    room.receive("A", networkCommand({ action: "chunk-added", x: 0, z: -1, heights: heights(0) }));

    assert.deepEqual(chunkKeys(room), ["0,-1", "0,0"]);
  });

  test("a chunk with heights outside the range is refused", () => {
    const room = liveRoom();
    room.receive("A", networkCommand({ action: "chunk-added", x: 1, z: 0, heights: heights(5000) }));

    assert.deepEqual(chunkKeys(room), ["0,0"]);
  });

  test("the last chunk cannot be removed", () => {
    const room = liveRoom();
    room.receive("A", networkCommand({ action: "chunk-removed", x: 0, z: 0 }));

    assert.deepEqual(chunkKeys(room), ["0,0"]);
  });

  test(`no chunk is admitted past ${MAX_TERRAIN_CHUNKS}`, () => {
    const room = liveRoom();
    for (let x = 1; x <= MAX_TERRAIN_CHUNKS; x++) {
      room.receive("A", networkCommand({ action: "chunk-added", x, z: 0, heights: heights(0) }));
    }

    assert.equal(room.state.size, MAX_TERRAIN_CHUNKS);
    assert.equal(room.state.has(new ChunkCoord(MAX_TERRAIN_CHUNKS, 0)), false);
  });

  test("a height patch is refused whole when one of its tiles is invalid", () => {
    const room = liveRoom();
    function flat(tile: number) {
      return { x: 0, z: 0, tile, heights: encodeHeights(tileHeights(4)) };
    }
    for (const tiles of [
      [flat(0), { ...flat(1), x: 5 }],
      [flat(0), { ...flat(1), heights: encodeHeights(tileHeights(5000)) }],
      [flat(0), { ...flat(1), heights: heights(4) }],
      [flat(0), flat(0)]
    ]) {
      room.receive("A", networkCommand({ action: "heights-patched", tiles }));
    }

    assert.ok(room.state.chunk(new ChunkCoord(0, 0))!.copyHeights().every((height) => height === 0));
    room.receive("A", networkCommand({ action: "heights-patched", tiles: [flat(5)] }));
    assert.deepEqual(room.state.chunk(new ChunkCoord(0, 0))!.tileHeights(1, 1), tileHeights(4));
  });
});
