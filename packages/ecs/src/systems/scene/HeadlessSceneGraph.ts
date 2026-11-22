// Import Internal Dependencies
import type { WorldAudio } from "../World.ts";
import {
  DETACHED_ACTOR_NODE,
  type ActorNode,
  type SceneEnvironment,
  type SceneGraph
} from "./SceneGraph.ts";

// CONSTANTS
const kEnvironment: SceneEnvironment = {
  apply: () => undefined,
  dispose: () => undefined
};

export class HeadlessSceneGraph implements SceneGraph {
  createNode(): ActorNode {
    return DETACHED_ACTOR_NODE;
  }

  createEnvironment(): SceneEnvironment {
    return kEnvironment;
  }

  createAudio(): WorldAudio {
    return {
      volume: 1
    };
  }

  prune(): void {
    return undefined;
  }
}
