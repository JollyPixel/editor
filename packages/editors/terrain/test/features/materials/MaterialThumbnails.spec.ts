// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate as settle } from "node:timers/promises";

// Import Third-party Dependencies
import { encodeContent } from "@jolly-pixel/asset-server";
import {
  GROUND_MATERIAL,
  TerrainDocument
} from "@jolly-pixel/asset.terrain/client";

// Import Internal Dependencies
import { MaterialThumbnails } from "#src/features/materials/model/MaterialThumbnails.ts";
import { TextureDocument } from "#src/features/materials/model/TextureDocument.ts";
import { TextureLeases } from "#src/features/materials/model/TextureLeases.ts";

function content(
  text: string
) {
  return encodeContent(new TextEncoder().encode(text));
}

function thumbnailsSetup() {
  const document = new TerrainDocument();
  document.load({ chunks: [{ x: 0, z: 0 }] });
  const textures = new Map<string, TextureDocument>();
  const live = new Set<string>();
  const released: string[] = [];
  const thumbnails = new MaterialThumbnails({
    document,
    leases: new TextureLeases((assetId) => {
      const texture = new TextureDocument();
      texture.load(content(`${assetId}-v1`));
      textures.set(assetId, texture);

      return {
        document: texture,
        ready: Promise.resolve(),
        release: () => released.push(assetId)
      };
    }),
    createUrl: (bytes) => {
      const url = `blob:${new TextDecoder().decode(bytes)}`;
      live.add(url);

      return url;
    },
    revokeUrl: (url) => live.delete(url)
  });

  return { document, thumbnails, textures, live, released };
}

describe("MaterialThumbnails", () => {
  test("a used texture gets a URL, renewed when its content changes and revoked once unused", async() => {
    const { document, thumbnails, textures, live, released } = thumbnailsSetup();
    document.updateMaterial(GROUND_MATERIAL.id, { albedo: { id: "grass", kind: "texture" } });
    await settle();
    assert.equal(thumbnails.url("grass"), "blob:grass-v1");

    textures.get("grass")!.load(content("grass-v2"));
    assert.equal(thumbnails.url("grass"), "blob:grass-v2");
    assert.deepEqual([...live], ["blob:grass-v2"]);

    document.updateMaterial(GROUND_MATERIAL.id, { albedo: null });
    assert.equal(thumbnails.url("grass"), null);
    assert.deepEqual([...live], []);
    assert.deepEqual(released, ["grass"]);
  });
});
