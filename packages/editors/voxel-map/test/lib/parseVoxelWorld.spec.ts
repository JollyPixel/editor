// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { parseVoxelWorld } from "../../src/lib/parseVoxelWorld.ts";

describe("parseVoxelWorld", () => {
  it("returns a validated version-one world", () => {
    const world = parseVoxelWorld(JSON.stringify({
      version: 1,
      chunkSize: 16,
      tilesets: [],
      layers: []
    }));

    assert.equal(world.version, 1);
    assert.equal(world.chunkSize, 16);
    assert.deepEqual(world.layers, []);
  });

  it("rejects invalid JSON and invalid world shapes", () => {
    assert.throws(
      () => parseVoxelWorld("{"),
      /payload is not JSON/
    );
    assert.throws(
      () => parseVoxelWorld(JSON.stringify({ version: 1, layers: [] })),
      /chunkSize is not a positive integer/
    );
  });
});
