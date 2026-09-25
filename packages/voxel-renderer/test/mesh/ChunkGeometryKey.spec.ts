// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockSurface } from "../../src/blocks/BlockSurface.ts";
import { ChunkGeometryKey } from "../../src/mesh/index.ts";

describe("ChunkGeometryKey", () => {
  it("encodes the default opaque front surface as the bare tileset id", () => {
    const key = new ChunkGeometryKey("pack:atlas", new BlockSurface());

    assert.equal(String(key), "pack:atlas");
    assert.ok(Object.isFrozen(key));
  });

  it("appends any other surface to the tileset id", () => {
    const surface = new BlockSurface({ alphaMode: "blend" });
    const key = new ChunkGeometryKey("atlas", surface);

    assert.equal(String(key), `atlas:surface=${JSON.stringify(surface)}`);
    assert.equal(key.surface, surface);
  });

  it("rejects a tileset id that would alias a surface key", () => {
    assert.throws(
      () => new ChunkGeometryKey("atlas:surface={}", new BlockSurface()),
      RangeError
    );
  });
});
