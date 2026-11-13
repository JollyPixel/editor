// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { AddedActor } from "#src/assets/scene/ActorSpec.ts";
import { McpAgent } from "../helpers/McpAgent.ts";
import {
  actorNamed,
  createForest,
  type SceneRead
} from "../helpers/mcpScene.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

describe("scene tools", { timeout: 15_000 }, () => {
  test("adds nested actors under an existing one", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const assetId = await createForest(agent);
    const sunId = await actorNamed(agent, assetId, "Sun");

    const { actors } = await agent.call<{ actors: AddedActor[]; }>(
      "scene_add_actors",
      {
        assetId,
        parentId: sunId,
        actors: [
          {
            name: "Halo",
            children: [{ name: "Ray" }]
          }
        ]
      }
    );

    const scene = await agent.call<SceneRead>("asset_read", { assetId });
    const parents = new Map(scene.actors.map((actor) => [actor.id, actor.parentId]));
    assert.deepEqual(
      actors.map(({ id, name }) => [name, parents.get(id)]),
      [["Halo", sunId], ["Ray", actors[0].id]]
    );
  });

  test("names actors and assets in components, moves and removes", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const assetId = await createForest(agent);
    const script = await agent.call<{ assetId: string; }>(
      "catalog_create",
      { path: "scripts/spin.ts" }
    );

    const { components } = await agent.call<{ components: { id: string; }[]; }>(
      "scene_add_components",
      {
        assetId,
        actor: "Sun",
        components: [{ type: "Script", assets: { script: "scripts/spin.ts" } }]
      }
    );
    await agent.call("scene_move_actors", {
      assetId,
      actors: ["Sun"],
      parent: "Sky"
    });
    const moved = await agent.call<SceneRead>("asset_read", { assetId });
    const sun = moved.actors.find(({ name }) => name === "Sun");
    assert.equal(sun?.parentId, await actorNamed(agent, assetId, "Sky"));
    assert.deepEqual(
      sun?.components.find(({ id }) => id === components[0].id)?.assets,
      { script: { id: script.assetId, kind: "script" } }
    );

    await agent.call("scene_remove_actors", { assetId, actors: ["Sky"] });
    const removed = await agent.call<SceneRead>("asset_read", { assetId });
    assert.deepEqual(removed.actors.map(({ name }) => name), ["Main Camera"]);
  });
});
