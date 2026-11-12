// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { McpAgent } from "./McpAgent.ts";

export interface SceneRead {
  actors: {
    id: string;
    name: string;
    parentId: string | null;
    components: {
      id: string;
      assets: unknown;
    }[];
  }[];
}

export async function createForest(
  agent: McpAgent
): Promise<string> {
  const { assetId } = await agent.call<{ assetId: string; }>(
    "catalog_create",
    { path: "levels/forest.scene.json" }
  );

  return assetId;
}

export async function actorNamed(
  agent: McpAgent,
  assetId: string,
  name: string
): Promise<string> {
  const scene = await agent.call<SceneRead>("asset_read", { assetId });
  const actor = scene.actors.find((actor) => actor.name === name);
  assert.ok(actor, `the scene has no "${name}" actor`);

  return actor.id;
}
