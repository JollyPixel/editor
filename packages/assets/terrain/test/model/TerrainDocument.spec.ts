// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GROUND_LAYER,
  terrainSnapshot
} from "#src/index.ts";
import {
  TerrainDocument,
  type TerrainImage
} from "#src/network/client.ts";

describe("TerrainDocument", () => {
  test("a rewind restores the layers and the texture size the changes replaced", () => {
    const document = new TerrainDocument();
    document.load({ chunks: [{ x: 0, z: 0 }] });
    const original = terrainSnapshot(document);
    const images: TerrainImage[] = [];
    document.on("change", ({ image }) => images.push(image));

    document.updateLayer(GROUND_LAYER.id, { tiling: 8 });
    const added = document.addLayer({ name: "Rock" });
    document.removeLayer(GROUND_LAYER.id);
    document.changeTextureSize(2048);
    document.revert(images);

    assert.notEqual(added, null);
    assert.deepEqual(terrainSnapshot(document), original);
  });
});
