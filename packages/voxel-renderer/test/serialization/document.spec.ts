// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeVoxelDocument,
  encodeVoxelDocument,
  parseVoxelDocument
} from "../../src/serialization/document.ts";
import {
  InvalidVoxelDocumentError
} from "../../src/serialization/errors/InvalidVoxelDocumentError.ts";
import type { VoxelWorldJSON } from "../../src/serialization/types.ts";

// CONSTANTS
const kEmptyDocument: VoxelWorldJSON = {
  version: 1,
  chunkSize: 16,
  tilesets: [],
  layers: []
};

describe("parseVoxelDocument", () => {
  it("returns the document when it is well formed", () => {
    assert.deepEqual(
      parseVoxelDocument({ ...kEmptyDocument }),
      kEmptyDocument
    );
  });

  it("defaults a missing tilesets field to an empty array", () => {
    const document = parseVoxelDocument({
      version: 1,
      chunkSize: 16,
      layers: []
    });

    assert.deepEqual(document.tilesets, []);
  });

  it("rejects a chunkSize that is not a number", () => {
    assert.throws(
      () => parseVoxelDocument({
        version: 1,
        chunkSize: "16",
        layers: []
      }),
      /chunkSize is not a positive integer/
    );
  });

  it("drops a blocks field that is not an array", () => {
    const document = parseVoxelDocument({
      version: 1,
      chunkSize: 16,
      layers: [],
      blocks: "not-a-list"
    });

    assert.equal(document.blocks, undefined);
  });

  it("drops an objectLayers field that is not an array", () => {
    const document = parseVoxelDocument({
      version: 1,
      chunkSize: 16,
      layers: [],
      objectLayers: 42
    });

    assert.equal(document.objectLayers, undefined);
  });

  it("drops unknown top-level fields", () => {
    const document = parseVoxelDocument({
      version: 1,
      chunkSize: 16,
      layers: [],
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
    ["unsupported version", { version: 2, chunkSize: 16, layers: [] }],
    ["chunkSize is not a positive integer", { version: 1, chunkSize: 0, layers: [] }],
    ["chunkSize is not a positive integer", { version: 1, chunkSize: 1.5, layers: [] }],
    ["layers is not an array", { version: 1, chunkSize: 16 }]
  ] as const) {
    it(`rejects ${JSON.stringify(payload)} with "${reason}"`, () => {
      assert.throws(
        () => parseVoxelDocument(payload),
        (error: unknown) => error instanceof InvalidVoxelDocumentError &&
          error.message.includes(reason)
      );
    });
  }
});

describe("encodeVoxelDocument / decodeVoxelDocument", () => {
  it("round-trips a document through bytes", () => {
    const bytes = encodeVoxelDocument(kEmptyDocument);

    assert.ok(bytes instanceof Uint8Array);
    assert.deepEqual(decodeVoxelDocument(bytes), kEmptyDocument);
  });

  it("rejects bytes that are not JSON", () => {
    assert.throws(
      () => decodeVoxelDocument(new TextEncoder().encode("{ nope")),
      /payload is not JSON/
    );
  });

  it("rejects JSON that is not a voxel document", () => {
    assert.throws(
      () => decodeVoxelDocument(new TextEncoder().encode("{}")),
      /unsupported version/
    );
  });
});
