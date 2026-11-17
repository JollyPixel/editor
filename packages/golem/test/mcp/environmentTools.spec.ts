// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  createEnvironmentFile,
  type EnvironmentFile
} from "@jolly-pixel/asset.environment/client";

// Import Internal Dependencies
import { McpAgent } from "../helpers/McpAgent.ts";
import { createForest } from "../helpers/mcpScene.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

describe("environment tools", { timeout: 15_000 }, () => {
  test("changes an environment from a preset and points a scene at it", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const { assetId } = await agent.call<{ assetId: string; }>(
      "catalog_create",
      { path: "environments/dusk.environment.json" }
    );
    const sceneId = await createForest(agent);

    const { changed, environment } = await agent.call<{
      changed: string[];
      environment: EnvironmentFile;
    }>("environment_change", {
      assetId,
      preset: "day",
      fog: {
        kind: "linear",
        far: 80
      }
    });
    await agent.call("scene_set_environment", {
      assetId: sceneId,
      environment: "environments/dusk.environment.json"
    });

    const day = createEnvironmentFile("day");
    assert.deepEqual(environment, {
      ...day,
      fog: {
        kind: "linear",
        color: "#c8d2dc",
        near: 10,
        far: 80
      }
    });
    assert.ok(changed.includes("sky") && changed.includes("fog"));
    assert.deepEqual(await agent.call("asset_read", { assetId }), environment);
    const scene = await agent.call<{ environment: unknown; }>(
      "asset_read",
      { assetId: sceneId }
    );
    assert.deepEqual(scene.environment, {
      id: assetId,
      kind: "environment"
    });
    assert.match(
      await agent.error("scene_set_environment", {
        assetId: sceneId,
        environment: "levels/forest.scene.json"
      }),
      /is a scene, not a environment/
    );
  });
});
