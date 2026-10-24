// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import { AssetPath } from "@jolly-pixel/asset";
import {
  BLOCKSET_KIND,
  VOXEL_MAP_KIND
} from "@jolly-pixel/asset.voxel-map";
import { decodePixelBytes } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  createDefaultSeed,
  STARTER_BLOCK_NAME
} from "../../src/boot/defaultSeed.ts";

function seededAsset(
  kind: string
) {
  const matches = Object.entries(createDefaultSeed("blockset-id").seed)
    .flatMap(([path, entry]) => (typeof entry === "object" && entry.kind === kind ?
      [{ path: new AssetPath(path), entry }] :
      []));
  assert.equal(matches.length, 1);

  return matches[0];
}

describe("createDefaultSeed", () => {
  it("seeds one map next to its blockset", () => {
    const { seed } = createDefaultSeed("blockset-id");
    const map = seededAsset(VOXEL_MAP_KIND);
    const blockset = seededAsset(BLOCKSET_KIND);

    assert.equal(Object.keys(seed).length, 2);
    assert.equal(blockset.entry.id, "blockset-id");
    assert.equal(map.path.directory, blockset.path.directory);
  });

  it("seeds a 512x512 blockset with 32px tiles and one opaque starter block", async() => {
    const content = await seededAsset(BLOCKSET_KIND).entry.content!();
    const blockset = JSON.parse(new TextDecoder().decode(content as Uint8Array));
    const pixels = decodePixelBytes(blockset.pixels.pixels);
    const alphas = [[0, 0], [31, 31], [32, 0]].map(([x, y]) => pixels[((y * 512) + x) * 4 + 3]);

    assert.deepEqual(blockset.pixels.size, { x: 512, y: 512 });
    assert.equal(blockset.tileSize, 32);
    assert.deepEqual(
      blockset.blocks.map((block: { name: string; defaultTexture: unknown; }) => [
        block.name,
        block.defaultTexture
      ]),
      [[STARTER_BLOCK_NAME, { col: 0, row: 0 }]]
    );
    assert.deepEqual(alphas, [255, 255, 0]);
  });
});
