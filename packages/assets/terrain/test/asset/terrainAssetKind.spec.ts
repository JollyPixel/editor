// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";
import {
  CHUNK_SAMPLE_COUNT,
  ChunkCoord,
  OVERVIEW_SAMPLE_COUNT
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeHeights,
  encodeTerrainFile,
  decodeHeights,
  decodeTerrainFile,
  MAX_TERRAIN_CHUNKS,
  terrainAssetKind,
  terrainSnapshot,
  TERRAIN_FILE_VERSION
} from "#src/index.ts";
import { CHUNK_COORDINATE_RANGE } from "#src/network/TerrainCommand.schema.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

function liveRoom() {
  return new LiveAssetRoom(terrainAssetKind());
}

function flatChunk(): Float32Array {
  return new Float32Array(CHUNK_SAMPLE_COUNT);
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

  test("serialize and load round-trip the chunk list and each chunk's part", async() => {
    const handler = terrainAssetKind();
    const room = new LiveAssetRoom(handler);
    room.receive("A", networkCommand({ action: "chunk-added", x: 1, z: 0, heights: heights(12.5) }));

    const loaded = handler.create("copy");
    handler.load(loaded, await handler.serialize(room.state));
    for (const partId of handler.parts!.list(room.state)) {
      handler.parts!.load(loaded, partId, await handler.parts!.serialize(room.state, partId));
    }

    assert.deepEqual([...handler.parts!.list(room.state)], ["0_0", "1_0"]);
    assert.deepEqual(terrainSnapshot(loaded), terrainSnapshot(room.state));
  });

  test("the document lists each chunk with its overview samples", async() => {
    const handler = terrainAssetKind();
    const room = new LiveAssetRoom(handler);
    room.receive("A", networkCommand({ action: "chunk-added", x: 1, z: 0, heights: heights(12.5) }));

    const { chunks } = decodeTerrainFile(await handler.serialize(room.state));

    assert.deepEqual(
      chunks.map(({ x, z, overview }) => [x, z, [...decodeHeights(overview!, OVERVIEW_SAMPLE_COUNT)!]]),
      [[0, 0, [0, 0, 0, 0]], [1, 0, [12.5, 12.5, 12.5, 12.5]]]
    );
  });

  test("a document may hold a chunk's heights inline", () => {
    const handler = terrainAssetKind();
    const content = encodeTerrainFile({
      version: TERRAIN_FILE_VERSION,
      chunks: [{ x: 0, z: 0, heights: heights(3) }]
    });

    const terrain = handler.create("asset");
    handler.load(terrain, content);

    assert.ok(terrain.chunk(new ChunkCoord(0, 0))!.copyHeights().every((height) => height === 3));
  });

  test("a part that is not a chunk of valid heights is refused", () => {
    const handler = terrainAssetKind();
    const terrain = handler.create("asset");

    assert.throws(
      () => handler.parts!.load(terrain, "0_0", new Uint8Array(8)),
      InvalidAssetFileError
    );
    assert.throws(
      () => handler.parts!.load(terrain, "origin", new Uint8Array(0)),
      InvalidAssetFileError
    );
  });

  test("load rejects a document with invalid heights", () => {
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
    const side = Math.sqrt(MAX_TERRAIN_CHUNKS);
    for (let index = 1; index < MAX_TERRAIN_CHUNKS; index++) {
      room.state.addChunk(new ChunkCoord(index % side, Math.floor(index / side)), flatChunk());
    }
    room.receive("A", networkCommand({ action: "chunk-added", x: side, z: 0, heights: heights(0) }));

    assert.equal(room.state.has(new ChunkCoord(side, 0)), false);
    assert.equal(room.state.size, MAX_TERRAIN_CHUNKS);
  });

  test("a chunk outside the coordinate range does not parse", () => {
    const room = liveRoom();
    const { max } = CHUNK_COORDINATE_RANGE;
    room.state.addChunk(new ChunkCoord(max, 0), flatChunk());
    function add(x: number): void {
      room.receive("A", networkCommand({ action: "chunk-added", x, z: 0, heights: heights(0) }));
    }
    assert.throws(() => add(max + 1), /does not parse/);
    add(max - 1);

    assert.deepEqual(chunkKeys(room), ["0,0", `${max - 1},0`, `${max},0`]);
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
