// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";

// Import Internal Dependencies
import { SceneTransform } from "#src/model/changes/SceneTransform.ts";
import {
  SceneTree,
  type SceneTreeOptions
} from "#src/model/tree/SceneTree.ts";
import type { SceneFile } from "#src/asset/scene.ts";
import type {
  AssetReferenceJSON,
  JSONObject,
  SceneEnvironmentJSON,
  SceneActorJSON,
  SceneCommand,
  SceneComponentJSON,
  SceneNetworkCommand,
  SceneSnapshot
} from "#src/network/types.ts";

let seq = 0;

export function actor(
  id: string,
  overrides: Partial<SceneActorJSON> = {}
): SceneActorJSON {
  return {
    id,
    name: id,
    parentId: null,
    visible: true,
    transform: SceneTransform.create(),
    components: [],
    ...overrides
  };
}

export function component(
  id: string,
  data: JSONObject = {},
  assets: Record<string, AssetReferenceJSON | null> = {}
): SceneComponentJSON {
  return {
    id,
    type: "Light",
    data,
    assets
  };
}

export function snapshot(
  actors: SceneActorJSON[],
  environment: SceneEnvironmentJSON = null
): SceneSnapshot {
  return {
    environment,
    actors
  };
}

export function sceneFile(
  actors: SceneActorJSON[],
  environment: SceneEnvironmentJSON = null
): SceneFile {
  return {
    version: 1,
    ...snapshot(actors, environment)
  };
}

export function loadedTree(
  actors: SceneActorJSON[],
  options: SceneTreeOptions = {}
): SceneTree {
  const tree = new SceneTree(options);
  tree.load(snapshot(actors));

  return tree;
}

export function treeIds(
  tree: { actorIds(): Iterable<string>; }
): string[] {
  return [...tree.actorIds()];
}

export function networkCommand<T extends SceneCommand>(
  command: T,
  overrides: Partial<NetworkCommandHeader> = {}
): T & SceneNetworkCommand {
  seq++;

  return {
    ...command,
    clientId: "client-A",
    seq,
    timestamp: 1000 + seq,
    ...overrides
  } as T & SceneNetworkCommand;
}

export function sampleActors(): SceneActorJSON[] {
  return [
    actor("A", {
      components: [
        component("light", { intensity: 1, color: "#ffffff" }, { cookie: null }),
        component("mesh")
      ]
    }),
    actor("B", { parentId: "A" }),
    actor("C")
  ];
}
