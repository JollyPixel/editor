// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { BlockSurface } from "../../src/blocks/BlockSurface.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import { ChunkGeometryKey } from "../../src/mesh/ChunkGeometryKey.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

describe("BlockSurface", () => {
  it("resolves independent alpha and side defaults", () => {
    assert.deepEqual({ ...new BlockSurface() }, {
      alphaMode: "opaque", side: "front", alphaCutoff: 0
    });
    assert.deepEqual({ ...new BlockSurface({ alphaMode: "blend" }) }, {
      alphaMode: "blend", side: "double", alphaCutoff: 0
    });

    const surface = new BlockSurface({
      alphaMode: "mask", alphaCutoff: 0.4
    });
    assert.equal(surface.alphaMode, "mask");
    assert.equal(surface.side, "double");
    assert.equal(surface.alphaCutoff, 0.4);
    assert.equal(surface.occludes, false);
    assert.ok(Object.isFrozen(surface));
    assert.equal(new BlockSurface({ alphaMode: "opaque" }).occludes, true);
  });

  it("rejects invalid cutoffs at registration even outside mask mode", () => {
    for (const alphaCutoff of [-0.1, 1.1, NaN, Infinity]) {
      assert.throws(() => new BlockRegistry([
        makeBlockDef(1, "cube", { alphaCutoff })
      ]), RangeError);
    }
    for (const alphaCutoff of [0, 1]) {
      assert.equal(new BlockSurface({
        alphaMode: "mask", alphaCutoff
      }).alphaCutoff, alphaCutoff);
    }
  });

  it("round-trips every policy without grouping different surfaces together", () => {
    const keys = new Set<string>();
    for (const alphaMode of ["opaque", "mask", "blend"] as const) {
      for (const side of ["front", "double"] as const) {
        const surface = new BlockSurface({ alphaMode, side, alphaCutoff: 0.3 });
        const key = new ChunkGeometryKey("atlas", surface);
        keys.add(key.toString());
        assert.deepEqual(ChunkGeometryKey.parse(key.toString()).surface, surface);
      }
    }

    assert.equal(keys.size, 6);
    assert.notEqual(new ChunkGeometryKey("atlas", new BlockSurface({
      alphaMode: "mask", alphaCutoff: 0.3
    })).toString(), new ChunkGeometryKey("atlas", new BlockSurface({
      alphaMode: "mask", alphaCutoff: 0.4
    })).toString());
  });
});
