// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { VoxelModelSnapshot } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { McpAgent } from "../helpers/McpAgent.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

describe("voxel model tools", { timeout: 15_000 }, () => {
  test("adds a material, then shaped blocks that use it by name", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const { assetId } = await agent.call<{ assetId: string; }>(
      "catalog_create",
      { path: "models/robot.voxelmodel.json" }
    );

    const { materials } = await agent.call<{ materials: { id: string; }[]; }>(
      "voxelmodel_add_materials",
      {
        assetId,
        materials: [{ name: "Rubber", surface: { color: "#202020" } }]
      }
    );
    await agent.call("voxelmodel_add_blocks", {
      assetId,
      blocks: [
        {
          name: "Wheel",
          material: "Rubber",
          shape: { type: "torus", sides: 12, ringSides: 6, thickness: 0.3 }
        }
      ]
    });

    const model = await agent.call<VoxelModelSnapshot>("asset_read", { assetId });
    const wheel = model.nodes.find(({ name }) => name === "Wheel");
    assert.ok(wheel?.kind === "block");
    assert.equal(wheel.materialId, materials[0].id);
    assert.equal(wheel.shape?.type, "torus");
  });
});
