// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkGeometryKey } from "../../src/mesh/index.ts";

describe("ChunkGeometryKey", () => {
  const kEncodings: [string, string, boolean][] = [
    ["atlas", "atlas", false],
    ["atlas:cutout", "atlas", true],
    ["pack:atlas", "pack:atlas", false]
  ];

  for (const [encoded, tilesetId, cutout] of kEncodings) {
    it(`round-trips "${encoded}"`, () => {
      const key = ChunkGeometryKey.parse(encoded);

      assert.equal(key.tilesetId, tilesetId);
      assert.equal(key.cutout, cutout);
      assert.equal(String(key), encoded);
      assert.equal(String(new ChunkGeometryKey(tilesetId, cutout)), encoded);
    });
  }

  it("defaults to a frozen solid group", () => {
    const key = new ChunkGeometryKey("atlas");

    assert.equal(key.cutout, false);
    assert.ok(Object.isFrozen(key));
  });

  it("rejects a tileset id that would alias a cutout key", () => {
    assert.throws(
      () => new ChunkGeometryKey("atlas:cutout"),
      RangeError
    );
  });

  it("compares by tileset and mode", () => {
    const cutout = new ChunkGeometryKey("atlas", true);

    assert.ok(cutout.equals(ChunkGeometryKey.parse("atlas:cutout")));
    assert.equal(cutout.equals(new ChunkGeometryKey("atlas")), false);
    assert.equal(cutout.equals(new ChunkGeometryKey("other", true)), false);
  });
});
