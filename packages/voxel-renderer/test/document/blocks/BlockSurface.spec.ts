// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { BlockSurface } from "../../../src/document/blocks/BlockSurface.ts";
import { BlockRegistry } from "../../../src/document/blocks/BlockRegistry.ts";
import { makeBlockDef } from "../../helpers/blocks.ts";

describe("BlockSurface", () => {
  it("resolves independent alpha and side defaults", () => {
    assert.deepEqual({ ...new BlockSurface() }, {
      alphaMode: "opaque", side: "front", alphaCutoff: 0, materialGroup: undefined
    });
    assert.deepEqual({ ...new BlockSurface({ alphaMode: "blend" }) }, {
      alphaMode: "blend", side: "double", alphaCutoff: 0, materialGroup: undefined
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

  it("keeps a material group and rejects an empty or non-string one", () => {
    assert.equal(new BlockSurface().materialGroup, undefined);
    assert.equal(
      new BlockSurface({ materialGroup: "gold" }).materialGroup,
      "gold"
    );
    assert.throws(
      () => new BlockSurface({ materialGroup: "" }),
      RangeError
    );
    assert.throws(() => new BlockRegistry([
      makeBlockDef(1, "cube", { materialGroup: 42 as unknown as string })
    ]), RangeError);
  });
});
