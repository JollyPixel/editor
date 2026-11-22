// Import Internal Dependencies
import type { GlobalAudio } from "../../../src/audio/GlobalAudio.ts";
import { ThreeSceneGraph } from "../../../src/scene/ThreeSceneGraph.ts";
import { createSceneSetup } from "./sceneSetup.ts";

type ThreeSceneSetup = ReturnType<typeof createSceneSetup> & {
  audio: GlobalAudio;
};

export function createThreeSceneSetup(): ThreeSceneSetup {
  const graph = new ThreeSceneGraph();
  const audio = graph.createAudio();

  return {
    ...createSceneSetup({ graph, audio }),
    audio
  };
}
