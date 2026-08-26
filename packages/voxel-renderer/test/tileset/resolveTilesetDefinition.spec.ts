// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveTilesetDefinition } from "../../src/tileset/types.ts";

// CONSTANTS
const kDefinition = {
  id: "default",
  src: "tileset.png",
  tileSize: 32
};

describe("resolveTilesetDefinition", () => {
  it("derives the tile grid from the atlas dimensions", () => {
    const resolved = resolveTilesetDefinition(kDefinition, {
      width: 128,
      height: 64
    });

    assert.deepEqual(resolved, {
      ...kDefinition,
      cols: 4,
      rows: 2
    });
  });

  it("floors partial tiles out of the grid", () => {
    const resolved = resolveTilesetDefinition(kDefinition, {
      width: 100,
      height: 33
    });

    assert.equal(resolved.cols, 3);
    assert.equal(resolved.rows, 1);
  });

  it("keeps explicit dimensions over the derived ones", () => {
    const resolved = resolveTilesetDefinition(
      {
        ...kDefinition,
        cols: 1,
        rows: 9
      },
      {
        width: 128,
        height: 64
      }
    );

    assert.equal(resolved.cols, 1);
    assert.equal(resolved.rows, 9);
  });
});
