// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { encodeContent } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { TextureDocument } from "#src/features/materials/model/TextureDocument.ts";
import { TextureLeases } from "#src/features/materials/model/TextureLeases.ts";

describe("TextureLeases", () => {
  test("holders share one lease, all hear its resets, and it ends with the last release", () => {
    const texture = new TextureDocument();
    const opened: string[] = [];
    const released: string[] = [];
    const leases = new TextureLeases((assetId) => {
      opened.push(assetId);

      return {
        document: texture,
        ready: Promise.resolve(),
        release: () => released.push(assetId)
      };
    });
    const heard: string[] = [];
    const gpu = leases.hold("rock", () => heard.push("gpu"));
    const thumbnail = leases.hold("rock", () => heard.push("thumbnail"));

    texture.load(encodeContent(new TextEncoder().encode("rock-v2")));
    thumbnail.release();
    thumbnail.release();
    texture.load(encodeContent(new TextEncoder().encode("rock-v3")));

    assert.deepEqual(opened, ["rock"]);
    assert.deepEqual(heard, ["gpu", "thumbnail", "gpu"]);
    assert.deepEqual(released, []);

    gpu.release();
    assert.deepEqual(released, ["rock"]);
  });
});
