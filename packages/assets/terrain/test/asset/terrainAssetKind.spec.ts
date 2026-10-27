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
  DEFAULT_TERRAIN_TEXTURE_SIZE,
  encodeHeights,
  encodeTerrainFile,
  decodeHeights,
  decodeTerrainFile,
  GROUND_MATERIAL,
  MAX_TERRAIN_CHUNKS,
  terrainAssetKind,
  terrainSnapshot,
  TERRAIN_FILE_VERSION
} from "#src/index.ts";
import {
  CHUNK_COORDINATE_RANGE,
  MAX_TERRAIN_MATERIALS
} from "#src/network/TerrainCommand.schema.ts";
import {
  heights,
  material,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

// CONSTANTS
const kRockMap = { id: "rock-albedo", kind: "texture" };
const kRockNormal = { id: "rock-normal", kind: "texture" };
const kRockHeight = { id: "rock-height", kind: "texture" };

function liveRoom() {
  return new LiveAssetRoom(terrainAssetKind());
}

function flatChunk(): Float32Array {
  return new Float32Array(CHUNK_SAMPLE_COUNT);
}

function chunkKeys(
  room: ReturnType<typeof liveRoom>
): string[] {
  return [...room.state.terrain.chunks()].map(({ coord }) => coord.key).sort();
}

function materialSlots(
  room: ReturnType<typeof liveRoom>
): number[] {
  return room.state.materials.materials().map(({ slot }) => slot);
}

describe("terrain asset kind", () => {
  test("a new terrain holds one flat chunk at the origin and the Ground material", () => {
    const { terrain, materials } = terrainAssetKind().create("asset");

    assert.deepEqual([...terrain.chunks()].map(({ coord }) => coord.key), ["0,0"]);
    assert.ok(terrain.chunk(new ChunkCoord(0, 0))!.copyHeights().every((height) => height === 0));
    assert.deepEqual(materials.materials(), [GROUND_MATERIAL]);
  });

  test("serialize and load round-trip the chunk list, the materials and each chunk's part", async() => {
    const handler = terrainAssetKind();
    const room = new LiveAssetRoom(handler);
    room.receive("A", networkCommand({ action: "chunk-added", x: 1, z: 0, heights: heights(12.5) }));
    const rock = material("rock", 3, { albedo: kRockMap });
    room.receive("A", networkCommand({ action: "material-added", material: rock }));
    room.receive("A", networkCommand({ action: "texture-size-changed", size: 2048 }));

    const manifest = await handler.serialize(room.state);
    const loaded = handler.create("copy");
    handler.load(loaded, manifest);
    for (const partId of handler.parts!.list(manifest)) {
      handler.parts!.load(loaded, partId, await handler.parts!.serialize(room.state, partId));
    }

    assert.deepEqual([...handler.parts!.list(manifest)], ["0_0", "1_0"]);
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

    const model = handler.create("asset");
    handler.load(model, content);

    assert.ok(model.terrain.chunk(new ChunkCoord(0, 0))!.copyHeights().every((height) => height === 3));
  });

  test("a document without materials loads the Ground material at the default texture size", () => {
    const handler = terrainAssetKind();
    const model = handler.create("asset");
    model.materials.load([material("rock", 3)], 2048);

    handler.load(model, encodeTerrainFile({
      version: TERRAIN_FILE_VERSION,
      chunks: [{ x: 0, z: 0 }]
    }));

    assert.deepEqual(model.materials.materials(), [GROUND_MATERIAL]);
    assert.equal(model.materials.textureSize, DEFAULT_TERRAIN_TEXTURE_SIZE);
  });

  test("load rejects a document whose materials share a slot", () => {
    const handler = terrainAssetKind();
    const content = encodeTerrainFile({
      version: TERRAIN_FILE_VERSION,
      chunks: [{ x: 0, z: 0 }],
      materials: [material("rock", 0), material("sand", 0)]
    });

    assert.throws(() => handler.load(handler.create("asset"), content), InvalidAssetFileError);
  });

  test("the materials' images are the terrain's dependencies, and rebind follows new IDs", () => {
    const handler = terrainAssetKind();
    const model = handler.create("asset");
    model.materials.add(material("rock", 1, { albedo: kRockMap, normal: kRockNormal, height: kRockHeight }));
    model.materials.add(material("moss", 2, { albedo: kRockMap }));

    assert.deepEqual(handler.dependencies!(model), [kRockMap, kRockNormal, kRockHeight]);

    handler.rebind!(model, new Map([[kRockMap.id, "rock-copy"]]));

    assert.deepEqual(
      handler.dependencies!(model),
      [{ ...kRockMap, id: "rock-copy" }, kRockNormal, kRockHeight]
    );
  });

  test("a material is admitted only with a new ID, on a free slot, under the material cap", () => {
    const room = liveRoom();
    function add(id: string, slot: number): void {
      room.receive("A", networkCommand({ action: "material-added", material: material(id, slot) }));
    }
    add("ground", 4);
    add("rock", 0);
    for (let slot = 1; slot <= MAX_TERRAIN_MATERIALS; slot++) {
      add(`material-${slot}`, slot);
    }

    assert.deepEqual(materialSlots(room), Array.from({ length: MAX_TERRAIN_MATERIALS }, (_, slot) => slot));
  });

  test("an update of a removed material and an unchanged texture size are refused", () => {
    const room = liveRoom();
    room.connect("A");
    room.take("A");
    room.receive("A", networkCommand({ action: "material-removed", id: GROUND_MATERIAL.id }));
    room.receive("A", networkCommand({
      action: "material-updated",
      id: GROUND_MATERIAL.id,
      changes: { tiling: 8 }
    }));
    room.receive("A", networkCommand({ action: "texture-size-changed", size: DEFAULT_TERRAIN_TEXTURE_SIZE }));

    assert.deepEqual(materialSlots(room), []);
    assert.deepEqual(
      room.take("A").map(({ type }) => type),
      ["command", "snapshot", "snapshot"]
    );
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
      room.state.terrain.addChunk(new ChunkCoord(index % side, Math.floor(index / side)), flatChunk());
    }
    room.receive("A", networkCommand({ action: "chunk-added", x: side, z: 0, heights: heights(0) }));

    assert.equal(room.state.terrain.has(new ChunkCoord(side, 0)), false);
    assert.equal(room.state.terrain.size, MAX_TERRAIN_CHUNKS);
  });

  test("a chunk outside the coordinate range does not parse", () => {
    const room = liveRoom();
    const { max } = CHUNK_COORDINATE_RANGE;
    room.state.terrain.addChunk(new ChunkCoord(max, 0), flatChunk());
    function add(x: number): void {
      room.receive("A", networkCommand({ action: "chunk-added", x, z: 0, heights: heights(0) }));
    }
    assert.throws(() => add(max + 1), /does not parse/);
    add(max - 1);

    assert.deepEqual(chunkKeys(room), ["0,0", `${max - 1},0`, `${max},0`]);
  });

  test("a height patch keeps its valid tiles and answers the author with the refused ones' heights", () => {
    const room = liveRoom();
    room.connect("A");
    room.take("A");
    function flat(tile: number) {
      return { x: 0, z: 0, tile, heights: encodeHeights(tileHeights(4)) };
    }
    const invalid = [
      { ...flat(1), x: 5 },
      { ...flat(1), heights: encodeHeights(tileHeights(5000)) },
      { ...flat(1), heights: heights(4) }
    ];
    invalid.forEach((tile, index) => {
      room.receive("A", networkCommand({ action: "heights-patched", tiles: [flat(index + 2), tile] }));
    });

    const chunk = room.state.terrain.chunk(new ChunkCoord(0, 0))!;
    const admitted = [chunk.tileHeights(2, 0), chunk.tileHeights(3, 0), chunk.tileHeights(0, 1)];
    assert.deepEqual(admitted.map((heights) => heights[0]), [4, 4, 4]);
    assert.deepEqual(chunk.tileHeights(1, 0), tileHeights(0));
    const corrections = room.take("A").filter((message) => message.type === "correction");
    assert.deepEqual(corrections.map(({ data }) => "tiles" in data && data.tiles.map(({ tile }) => tile)), [
      [2],
      [1],
      [1]
    ]);
  });

  test("a height patch naming a tile twice is refused whole", () => {
    const room = liveRoom();
    const tile = { x: 0, z: 0, tile: 0, heights: encodeHeights(tileHeights(4)) };
    room.receive("A", networkCommand({ action: "heights-patched", tiles: [tile, tile] }));

    assert.deepEqual(room.state.terrain.chunk(new ChunkCoord(0, 0))!.tileHeights(0, 0), tileHeights(0));
  });
});
