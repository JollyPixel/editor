// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PixelRead } from "@jolly-pixel/asset.pixel-art/golem";

// Import Internal Dependencies
import { McpAgent } from "../helpers/McpAgent.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

describe("pixel art intents", { timeout: 15_000 }, () => {
  test("fills a rect, paints over it and reads the pixels back", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const { assetId } = await agent.call<{ assetId: string; }>(
      "catalog_create",
      { path: "textures/hero.pixelart" }
    );

    await agent.intent(assetId, "fillRect", {
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      color: "#336699"
    });
    await agent.intent(assetId, "paintPixels", {
      pixels: [{ x: 1, y: 0, color: "#ffffff00" }]
    });

    const read = await agent.intent<PixelRead>(assetId, "readPixels", {
      x: 0,
      y: 0,
      width: 2,
      height: 1
    });
    assert.deepEqual(read.rows, [["#336699ff", "#ffffff00"]]);
  });

  test("paints a blockset's texture, which a scene cannot", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const blockset = await agent.call<{ assetId: string; }>(
      "catalog_create",
      { path: "blocksets/rocks.blockset.json" }
    );
    const scene = await agent.call<{ assetId: string; }>(
      "catalog_create",
      { path: "levels/forest.scene.json" }
    );

    await agent.intent(blockset.assetId, "fillRect", {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: "#336699"
    });

    const read = await agent.intent<PixelRead>(blockset.assetId, "readPixels", {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    });
    assert.deepEqual(read.rows, [["#336699ff"]]);
    assert.match(
      await agent.intentError(scene.assetId, "paintPixels", {
        pixels: [{ x: 0, y: 0, color: "#ffffff" }]
      }),
      /"scene" assets have no "paintPixels" intent/
    );
  });
});
