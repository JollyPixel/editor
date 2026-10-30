// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GROUND_MATERIAL,
  terrainSnapshot
} from "#src/index.ts";
import {
  TerrainDocument,
  type TerrainImage
} from "#src/network/client.ts";

describe("TerrainDocument", () => {
  test("a rewind restores the materials and the texture size the changes replaced", () => {
    const document = new TerrainDocument();
    document.load({ chunks: [{ x: 0, z: 0 }] });
    const original = terrainSnapshot(document);
    const images: TerrainImage[] = [];
    document.on("change", ({ image }) => images.push(image));

    document.updateMaterial(GROUND_MATERIAL.id, { tiling: 8 });
    const added = document.addMaterial({ name: "Rock" });
    document.removeMaterial(GROUND_MATERIAL.id);
    document.changeTextureSize(2048);
    document.revert(images);

    assert.notEqual(added, null);
    assert.deepEqual(terrainSnapshot(document), original);
  });

  test("a chunk past the coordinate range is refused before it is committed", () => {
    const document = new TerrainDocument();
    document.load({ chunks: [{ x: 127, z: 0 }] });
    let changes = 0;
    document.on("change", () => changes++);

    assert.equal(document.canAddChunk(126, 0), true);
    assert.equal(document.canAddChunk(128, 0), false);
    assert.equal(document.addChunk(128, 0), false);
    assert.equal(changes, 0);
  });
});
