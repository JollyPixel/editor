// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { MapSummary } from "#src/assets/voxelMap/VoxelMapAsset.ts";
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

describe("voxel map tools", { timeout: 15_000 }, () => {
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
    const { blocksets } = await agent.call<MapSummary>("voxelmap_summary", { assetId });
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
    const { layer } = await agent.call<{ layer: { id: string; name: string; }; }>(
      "voxelmap_add_layer",
      {
        assetId,
        name: "Ground"
      }
    );
    assert.equal(layer.name, "Ground");

    assert.deepEqual(await agent.call("voxelmap_fill_box", {
      assetId,
      layer: "Ground",
      ...kBox,
      block: "grass"
    }), {
      assetId,
      written: 6
    });
    assert.deepEqual(await agent.call("voxelmap_heightmap", {
      assetId,
      ...kBox
    }), {
      min: {
        x: 0,
        z: 0
      },
      heights: [[2, 2]]
    });
    assert.deepEqual(await agent.call("voxelmap_clear_box", {
      assetId,
      layer: layer.id,
      ...kBox
    }), {
      assetId,
      cleared: 6
    });
  });
});
