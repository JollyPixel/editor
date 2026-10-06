// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  TILESET_KIND,
  VOXEL_MAP_KIND
} from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import { createDefaultSeed } from "../../src/boot/defaultSeed.ts";

function seedEntry(
  path: string
) {
  const entry = createDefaultSeed("tileset-id").seed[path];
  assert.ok(typeof entry === "object");

  return entry;
}

describe("createDefaultSeed", () => {
  it("seeds the overworld map next to its tileset", () => {
    const { seed } = createDefaultSeed("tileset-id");

    assert.deepEqual(Object.keys(seed).sort(), [
      "maps/overworld.tileset.json",
      "maps/overworld.voxelmap.json"
    ]);
    assert.equal(seedEntry("maps/overworld.tileset.json").id, "tileset-id");
    assert.equal(seedEntry("maps/overworld.tileset.json").kind, TILESET_KIND);
    assert.equal(seedEntry("maps/overworld.voxelmap.json").kind, VOXEL_MAP_KIND);
  });

  it("seeds a blank 512x512 tileset with 32px tiles and no blocks", async() => {
    const content = await seedEntry("maps/overworld.tileset.json").content!();
    const tileset = JSON.parse(new TextDecoder().decode(content as Uint8Array));

    assert.deepEqual(tileset.pixels.size, { x: 512, y: 512 });
    assert.equal(tileset.tileSize, 32);
    assert.deepEqual(tileset.blocks, []);
  });
});
