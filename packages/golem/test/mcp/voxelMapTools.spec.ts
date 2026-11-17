// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { MapSummary } from "@jolly-pixel/asset.voxel-map/golem";

// Import Internal Dependencies
import { McpAgent } from "../helpers/McpAgent.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

// CONSTANTS
const kBox = {
  min: {
    x: 0,
    y: 0,
    z: 0
  },
  max: {
    x: 1,
    y: 2,
    z: 0
  }
};

describe("voxel map intents", { timeout: 15_000 }, () => {
  test("fills a box with a named block, reads it from above, then clears it", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const { assetId } = await agent.call<{ assetId: string; }>(
      "catalog_create",
      { path: "maps/field.voxelmap.json" }
    );
    const { blocksets } = await agent.intent<MapSummary>(assetId, "summary");
    await agent.call("asset_apply", {
      assetId: blocksets[0].assetId,
      commands: [
        {
          action: "block-defined",
          block: {
            id: 1,
            name: "grass",
            shapeId: "cube",
            faceTextures: {},
            collidable: true,
            properties: {}
          }
        }
      ]
    });
    const { layer } = await agent.intent<{ layer: { id: string; name: string; }; }>(
      assetId,
      "addLayer",
      {
        name: "Ground"
      }
    );
    assert.equal(layer.name, "Ground");

    assert.deepEqual(await agent.intent(assetId, "fillBox", {
      layer: "Ground",
      ...kBox,
      block: "grass"
    }), {
      written: 6
    });
    assert.deepEqual(await agent.intent(assetId, "heightmap", {
      ...kBox
    }), {
      min: {
        x: 0,
        z: 0
      },
      heights: [[2, 2]]
    });
    assert.deepEqual(await agent.intent(assetId, "clearBox", {
      layer: layer.id,
      ...kBox
    }), {
      cleared: 6
    });
  });
});
