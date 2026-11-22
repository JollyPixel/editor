// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry
} from "@jolly-pixel/asset";
import { Actor, Systems } from "@jolly-pixel/ecs";

export interface SceneSetupOptions {
  logger?: Systems.Logger;
  graph?: Systems.SceneGraph;
  audio?: Systems.WorldAudio;
}

export function createSceneSetup(
  options: SceneSetupOptions = {}
) {
  const {
    logger = new Systems.Logger(),
    graph = new Systems.HeadlessSceneGraph(),
    audio = graph.createAudio()
  } = options;
  const sm = new Systems.SceneManager(graph);
  const keepAlives = new Set<() => boolean>();
  const world = {
    logger,
    sceneManager: sm,
    assetCoordinator: new AssetCoordinator({
      catalog: new AssetCatalog(),
      loaders: new AssetLoaderRegistry()
    }),
    audio,
    renderer: {
      source: null
    },
    keepAlives,
    keepAlive(
      predicate: () => boolean
    ) {
      keepAlives.add(predicate);

      return () => keepAlives.delete(predicate);
    },
    invalidate: mock.fn(),
    createActor(name: string) {
      return new Actor(this as any, { name });
    }
  };
  sm.bindWorld(world as any);

  return { sm, world };
}
