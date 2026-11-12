// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelRead } from "#src/assets/pixelArt/PixelSurface.ts";
import { McpAgent } from "../helpers/McpAgent.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

describe("pixel art tools", { timeout: 15_000 }, () => {
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

    await agent.call("pixelart_fill_rect", {
      assetId,
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      color: "#336699"
    });
    await agent.call("pixelart_paint", {
      assetId,
      pixels: [{ x: 1, y: 0, color: "#ffffff00" }]
    });

    const read = await agent.call<PixelRead>("pixelart_read_pixels", {
      assetId,
      x: 0,
      y: 0,
      width: 2,
      height: 1
    });
    assert.deepEqual(read.rows, [["#336699ff", "#ffffff00"]]);
  });

  test("paints a blockset's texture, and names both kinds for another asset", async() => {
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

    await agent.call("pixelart_fill_rect", {
      assetId: blockset.assetId,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      color: "#336699"
    });

    const read = await agent.call<PixelRead>("pixelart_read_pixels", {
      assetId: blockset.assetId,
      x: 0,
      y: 0,
      width: 1,
      height: 1
    });
    assert.deepEqual(read.rows, [["#336699ff"]]);
    assert.match(
      await agent.error("pixelart_paint", {
        assetId: scene.assetId,
        pixels: [{ x: 0, y: 0, color: "#ffffff" }]
      }),
      /is a scene, not a pixelart or blockset/
    );
  });
});
