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
import { MAX_BLOCK_ID } from "../../../src/document/world/index.ts";

// CONSTANTS
const kEmptyWorld: VoxelWorldJSON = {
  version: VOXEL_WORLD_VERSION,
  chunkSize: 16,
  blocksets: [],
  layers: []
};

function worldWith(
  layer: object
): object {
  return {
    ...kEmptyWorld,
    layers: [layer]
  };
}

function layerWith(
  fields: object
): object {
  return {
    id: "l1",
    name: "Ground",
    visible: true,
    rank: "V",
    palette: [{ block: 1, transform: 0 }],
    chunks: [],
    ...fields
  };
}

function templateWith(
  fields: object
): object {
  return {
    ...kEmptyWorld,
    templates: [{
      id: "t1",
      name: "Steps",
      pivot: { x: 0, y: 0, z: 0 },
      chunkSize: 4,
      palette: [{ block: 1, transform: 0 }],
      chunks: [{ at: [0, 0, 0], runs: [64, 1] }],
      ...fields
    }]
  };
}

function chunkWith(
  chunk: object
): object {
  return worldWith(layerWith({ chunks: [chunk] }));
}

function paletteWith(
  entry: object
): object {
  return worldWith(layerWith({ palette: [entry] }));
}

function originChunkWith(
  fields: object
): object {
  return chunkWith({ at: [0, 0, 0], ...fields });
}

describe("parseVoxelWorld", () => {
  it("returns the document when it is well formed", () => {
    const document: VoxelWorldJSON = {
      ...kEmptyWorld,
      layers: [{
        id: "l1",
        name: "Ground",
        visible: true,
        rank: "V",
        palette: [{ block: 1, transform: 0 }],
        chunks: [
          { at: [0, 0, 0], runs: [256, 1, 3840, 0] },
          { at: [-1, 2, 3], cells: [17, 0], runs: [2, 1] }
        ]
      }]
    };

    assert.deepEqual(parseVoxelWorld(structuredClone(document)), document);
  });

  it("defaults a missing blocksets field to an empty array", () => {
    const document = parseVoxelWorld({
      version: VOXEL_WORLD_VERSION,
      chunkSize: 16,
      layers: []
    });

    assert.deepEqual(document.blocksets, []);
  });

  it("keeps well formed templates", () => {
    const document = templateWith({});

    assert.deepEqual(parseVoxelWorld(document), document);
  });

  it("drops an objectLayers field that is not an array", () => {
    const document = parseVoxelWorld({
      ...kEmptyWorld,
      objectLayers: 42
    });

    assert.equal(document.objectLayers, undefined);
  });

  it("drops unknown and retired top-level fields", () => {
    const document = parseVoxelWorld({
      ...kEmptyWorld,
      blocks: [],
      materialGroups: [],
      defaultTileSize: 32,
      whatever: "kept out"
    });

    assert.deepEqual(Object.keys(document), [
      "version",
      "chunkSize",
      "blocksets",
      "layers"
    ]);
  });

  const kFullChunk = [4096, 1];

  for (const [index, [reason, payload]] of ([
    ["payload is not an object", null],
    ["payload is not an object", 42],
    ["unsupported version 1", { ...kEmptyWorld, version: 1 }],
    ["unsupported version 2", {
      ...kEmptyWorld,
      version: 2,
      layers: [{ id: "l1", name: "Ground", visible: true, rank: "V", voxels: {} }]
    }],
    ["chunkSize is not a power of two", { ...kEmptyWorld, chunkSize: 0 }],
    ["chunkSize is not a power of two", { ...kEmptyWorld, chunkSize: 1.5 }],
    ["chunkSize is not a power of two", { ...kEmptyWorld, chunkSize: 12 }],
    ["chunkSize is not a power of two", { ...kEmptyWorld, chunkSize: "16" }],
    ["layers is not an array", { version: VOXEL_WORLD_VERSION, chunkSize: 16 }],
    ["layer 0 is not an object", { ...kEmptyWorld, layers: [null] }],
    ["layer 0: id is not a string", worldWith({})],
    ["layer \"l1\": visible is not a boolean", worldWith(layerWith({ visible: "yes" }))],
    ["layer \"l1\": compositing is not", worldWith(layerWith({ compositing: "multiply" }))],
    ["layer \"l1\": position is not a coordinate", worldWith(layerWith({
      position: { x: "1", y: 0, z: 0 }
    }))],
    ["layer \"l1\": palette is not an array", worldWith(layerWith({ palette: undefined }))],
    ["layer \"l1\": chunks is not an array", worldWith(layerWith({
      chunks: undefined,
      voxels: {}
    }))],
    ["palette entry 0: block 0 is out of range", paletteWith({ block: 0, transform: 0 })],
    [
      `palette entry 0: block ${MAX_BLOCK_ID + 1} is out of range`,
      paletteWith({ block: MAX_BLOCK_ID + 1, transform: 0 })
    ],
    ["palette entry 0: transform 256 is out of range", paletteWith({ block: 1, transform: 256 })],
    ["palette entry 0 has no numeric block", paletteWith({ block: "1", transform: 0 })],
    ["chunk 0: at is not a chunk coordinate", chunkWith({ at: [1024, 0, 0], runs: kFullChunk })],
    ["chunk 0: at is not a chunk coordinate", chunkWith({ at: [0, -513, 0], runs: kFullChunk })],
    ["chunk 0: at is not a chunk coordinate", chunkWith({ at: [0.5, 0, 0], runs: kFullChunk })],
    [
      "layer \"l1\": chunk [0,0,0] appears twice",
      worldWith(layerWith({
        chunks: [
          { at: [0, 0, 0], runs: kFullChunk },
          { at: [0, 0, 0], runs: kFullChunk }
        ]
      }))
    ],
    ["chunk [0,0,0]: runs is not an array", originChunkWith({})],
    ["chunk [0,0,0]: runs is not an array", originChunkWith({ runs: [-1, 1] })],
    ["chunk [0,0,0]: cells is not an array", originChunkWith({ cells: "0", runs: [1, 1] })],
    ["chunk [0,0,0]: runs has an odd length", originChunkWith({ runs: [4096] })],
    ["chunk [0,0,0]: run 0 has length 0", originChunkWith({ runs: [0, 1, 4096, 0] })],
    ["chunk [0,0,0]: run 0 has value 2 past the palette", originChunkWith({ runs: [4096, 2] })],
    ["chunk [0,0,0]: runs cover 100 cells instead of 4096", originChunkWith({ runs: [100, 1] })],
    ["chunk [0,0,0]: runs cover more than 4096 cells", originChunkWith({ runs: [5000, 1] })],
    ["chunk [0,0,0]: run 0 has value 0 outside the palette", originChunkWith({ cells: [0], runs: [1, 0] })],
    ["chunk [0,0,0]: runs assign 1 cells instead of 2", originChunkWith({ cells: [0, 1], runs: [1, 1] })],
    ["chunk [0,0,0]: cell 0 lies past 4095", originChunkWith({ cells: [4096], runs: [1, 1] })],
    ["templates is not an array", { ...kEmptyWorld, templates: {} }],
    ["template 0 is not an object", { ...kEmptyWorld, templates: [null] }],
    ["template 0: id is not a string", templateWith({ id: 1 })],
    ["template \"t1\": pivot is not a coordinate", templateWith({ pivot: undefined })],
    ["template \"t1\": chunkSize is not a power of two", templateWith({ chunkSize: 12 })],
    [
      "template \"t1\": chunk [0,0,0]: runs cover more than 64 cells",
      templateWith({ chunks: [{ at: [0, 0, 0], runs: kFullChunk }] })
    ]
  ] as const).entries()) {
    it(`rejects case ${index} with "${reason}"`, () => {
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

  it("reads JSON behind a byte order mark and whitespace", () => {
    const text = new TextEncoder().encode(`\n  ${JSON.stringify(kEmptyWorld)}`);
    const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, ...text]);

    assert.deepEqual(decodeVoxelWorld(bytes), kEmptyWorld);
  });

  it("rejects bytes that are not a known format", () => {
    assert.throws(
      () => decodeVoxelWorld(new TextEncoder().encode("JPVW")),
      /payload is not a known format/
    );
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
