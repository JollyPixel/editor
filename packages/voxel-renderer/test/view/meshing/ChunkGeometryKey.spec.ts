// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockSurface,
  type BlockSurfaceOptions
} from "../../../src/document/blocks/BlockSurface.ts";
import { ChunkGeometryKey } from "../../../src/view/meshing/index.ts";

function keyOf(
  options?: BlockSurfaceOptions
): string {
  return String(new ChunkGeometryKey("atlas", new BlockSurface(options)));
}

describe("ChunkGeometryKey", () => {
  it("encodes the default opaque front surface as the bare blockset id", () => {
    const key = new ChunkGeometryKey("pack:atlas", new BlockSurface());

    assert.equal(String(key), "pack:atlas");
    assert.ok(Object.isFrozen(key));
  });

  it("appends any other surface to the blockset id", () => {
    const surface = new BlockSurface({ alphaMode: "blend" });
    const key = new ChunkGeometryKey("atlas", surface);

    assert.equal(String(key), `atlas:surface=${JSON.stringify(surface)}`);
    assert.equal(key.surface, surface);
  });

  it("rejects a blockset id that would alias a surface key", () => {
    assert.throws(
      () => new ChunkGeometryKey("atlas:surface={}", new BlockSurface()),
      RangeError
    );
  });

  it("keys a material group apart from the same ungrouped surface", () => {
    for (const alphaMode of ["opaque", "blend"] as const) {
      assert.notEqual(
        keyOf({ alphaMode, materialGroup: "gold" }),
        keyOf({ alphaMode })
      );
    }
  });

  it("keys every policy apart, never merging distinct surfaces", () => {
    const keys = new Set<string>();
    for (const alphaMode of ["opaque", "mask", "blend"] as const) {
      for (const side of ["front", "double"] as const) {
        keys.add(keyOf({ alphaMode, side, alphaCutoff: 0.3 }));
      }
    }

    assert.equal(keys.size, 6);
    assert.equal(keys.has(keyOf({ materialGroup: "gold" })), false);
    assert.notEqual(
      keyOf({ alphaMode: "mask", alphaCutoff: 0.3 }),
      keyOf({ alphaMode: "mask", alphaCutoff: 0.4 })
    );
  });
});
