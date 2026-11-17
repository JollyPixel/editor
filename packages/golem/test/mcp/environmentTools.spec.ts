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

    const opened = await agent.call<{
      guide: string;
      intents: { name: string; input: { properties: object; }; }[];
    }>("asset_open", { assetId });
    assert.match(opened.guide, /`change` intent/);
    assert.deepEqual(opened.intents.map(({ name }) => name), ["change"]);
    assert.ok("fog" in opened.intents[0].input.properties);

    const { result: { changed, environment } } = await agent.call<{
      result: {
        changed: string[];
        environment: EnvironmentFile;
      };
    }>("asset_intent", {
      assetId,
      intent: "change",
      input: {
        preset: "day",
        fog: {
          kind: "linear",
          far: 80
        }
      }
    });
    await agent.intent(sceneId, "useEnvironment", {
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
      await agent.intentError(sceneId, "useEnvironment", {
        environment: "levels/forest.scene.json"
      }),
      /is a scene, not a environment/
    );
  });

  test("refuses an unknown intent and an input outside its schema", async() => {
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

    assert.match(
      await agent.error("asset_intent", {
        assetId,
        intent: "repaint"
      }),
      /no "repaint" intent; they have change/
    );
    assert.match(
      await agent.error("asset_intent", {
        assetId,
        intent: "change",
        input: {
          fog: {
            kind: "volumetric"
          }
        }
      }),
      /intent input is invalid[\s\S]*fog\.kind/
    );
    assert.deepEqual(
      await agent.call("asset_read", { assetId }),
      createEnvironmentFile()
    );
  });
});
