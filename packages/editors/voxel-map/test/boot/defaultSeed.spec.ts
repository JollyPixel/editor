// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  BLOCKSET_KIND,
  VOXEL_MAP_KIND
} from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import { createDefaultSeed } from "../../src/boot/defaultSeed.ts";

function seedEntry(
  path: string
) {
  const entry = createDefaultSeed("blockset-id").seed[path];
  assert.ok(typeof entry === "object");

  return entry;
}

describe("createDefaultSeed", () => {
  it("seeds the overworld map next to its blockset", () => {
    const { seed } = createDefaultSeed("blockset-id");

    assert.deepEqual(Object.keys(seed).sort(), [
      "maps/overworld.blockset.json",
      "maps/overworld.voxelmap.json"
    ]);
    assert.equal(seedEntry("maps/overworld.blockset.json").id, "blockset-id");
    assert.equal(seedEntry("maps/overworld.blockset.json").kind, BLOCKSET_KIND);
    assert.equal(seedEntry("maps/overworld.voxelmap.json").kind, VOXEL_MAP_KIND);
  });

  it("seeds a blank 512x512 blockset with 32px tiles and no blocks", async() => {
    const content = await seedEntry("maps/overworld.blockset.json").content!();
    const blockset = JSON.parse(new TextDecoder().decode(content as Uint8Array));

    assert.deepEqual(blockset.pixels.size, { x: 512, y: 512 });
    assert.equal(blockset.tileSize, 32);
    assert.deepEqual(blockset.blocks, []);
  });
});
