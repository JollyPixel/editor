// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkGeometryKey } from "../../src/mesh/ChunkGeometryKey.ts";

describe("ChunkGeometryKey", () => {
  it("encodes a solid group as the bare tileset id", () => {
    assert.equal(String(new ChunkGeometryKey("atlas")), "atlas");
  });

  it("suffixes a cutout group", () => {
    assert.equal(String(new ChunkGeometryKey("atlas", true)), "atlas:cutout");
  });

  it("defaults to a solid group", () => {
    assert.equal(new ChunkGeometryKey("atlas").cutout, false);
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(new ChunkGeometryKey("atlas")));
  });

  it("rejects a tileset id that would alias a cutout key", () => {
    assert.throws(
      () => new ChunkGeometryKey("atlas:cutout"),
      RangeError
    );
  });
});

describe("ChunkGeometryKey.parse", () => {
  it("reads a solid group", () => {
    const key = ChunkGeometryKey.parse("atlas");

    assert.equal(key.tilesetId, "atlas");
    assert.equal(key.cutout, false);
  });

  it("reads a cutout group", () => {
    const key = ChunkGeometryKey.parse("atlas:cutout");

    assert.equal(key.tilesetId, "atlas");
    assert.equal(key.cutout, true);
  });

  it("keeps a colon that is not the cutout suffix", () => {
    const key = ChunkGeometryKey.parse("pack:atlas");

    assert.equal(key.tilesetId, "pack:atlas");
    assert.equal(key.cutout, false);
  });

  it("round-trips both groups", () => {
    for (const encoded of ["atlas", "atlas:cutout"]) {
      assert.equal(String(ChunkGeometryKey.parse(encoded)), encoded);
    }
  });
});

describe("ChunkGeometryKey#equals", () => {
  it("is true for the same tileset and mode", () => {
    assert.ok(
      new ChunkGeometryKey("atlas", true)
        .equals(ChunkGeometryKey.parse("atlas:cutout"))
    );
  });

  it("is false when the mode differs", () => {
    assert.equal(
      new ChunkGeometryKey("atlas").equals(new ChunkGeometryKey("atlas", true)),
      false
    );
  });

  it("is false when the tileset differs", () => {
    assert.equal(
      new ChunkGeometryKey("atlas").equals(new ChunkGeometryKey("other")),
      false
    );
  });
});
