// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeVoxelWorld,
  encodeVoxelWorld,
  InvalidVoxelWorldError,
  parseVoxelWorld,
  VOXEL_WORLD_VERSION,
  type VoxelWorldJSON
} from "../../../src/document/serialization/index.ts";

// CONSTANTS
const kEmptyWorld: VoxelWorldJSON = {
  version: VOXEL_WORLD_VERSION,
  chunkSize: 16,
  tilesets: [],
  layers: []
};

describe("parseVoxelWorld", () => {
  it("returns the document when it is well formed", () => {
    assert.deepEqual(
      parseVoxelWorld({ ...kEmptyWorld }),
      kEmptyWorld
    );
  });

  it("defaults a missing tilesets field to an empty array", () => {
    const document = parseVoxelWorld({
      version: VOXEL_WORLD_VERSION,
      chunkSize: 16,
      layers: []
    });

    assert.deepEqual(document.tilesets, []);
  });

  it("rejects a chunkSize that is not a number", () => {
    assert.throws(
      () => parseVoxelWorld({
        version: VOXEL_WORLD_VERSION,
        chunkSize: "16",
        layers: []
      }),
      /chunkSize is not a positive integer/
    );
  });

  it("drops an objectLayers field that is not an array", () => {
    const document = parseVoxelWorld({
      version: VOXEL_WORLD_VERSION,
      chunkSize: 16,
      layers: [],
      objectLayers: 42
    });

    assert.equal(document.objectLayers, undefined);
  });

  it("drops unknown and retired top-level fields", () => {
    const document = parseVoxelWorld({
      version: VOXEL_WORLD_VERSION,
      chunkSize: 16,
      layers: [],
      blocks: [],
      materialGroups: [],
      defaultTileSize: 32,
      __proto__polluted: true,
      whatever: "kept out"
    });

    assert.deepEqual(Object.keys(document), [
      "version",
      "chunkSize",
      "tilesets",
      "layers"
    ]);
  });

  for (const [reason, payload] of [
    ["payload is not an object", null],
    ["payload is not an object", 42],
    ["unsupported version", { version: 1, chunkSize: 16, layers: [] }],
    ["unsupported version", { version: 3, chunkSize: 16, layers: [] }],
    ["chunkSize is not a positive integer", { version: 2, chunkSize: 0, layers: [] }],
    ["chunkSize is not a positive integer", { version: 2, chunkSize: 1.5, layers: [] }],
    ["layers is not an array", { version: 2, chunkSize: 16 }]
  ] as const) {
    it(`rejects ${JSON.stringify(payload)} with "${reason}"`, () => {
      assert.throws(
        () => parseVoxelWorld(payload),
        (error: unknown) => error instanceof InvalidVoxelWorldError &&
          error.message.includes(reason)
      );
    });
  }
});

describe("encodeVoxelWorld / decodeVoxelWorld", () => {
  it("round-trips a document through bytes", () => {
    const bytes = encodeVoxelWorld(kEmptyWorld);

    assert.ok(bytes instanceof Uint8Array);
    assert.deepEqual(decodeVoxelWorld(bytes), kEmptyWorld);
  });

  it("rejects bytes that are not JSON", () => {
    assert.throws(
      () => decodeVoxelWorld(new TextEncoder().encode("{ nope")),
      /payload is not JSON/
    );
  });

  it("rejects JSON that is not a voxel document", () => {
    assert.throws(
      () => decodeVoxelWorld(new TextEncoder().encode("{}")),
      /unsupported version/
    );
  });
});
