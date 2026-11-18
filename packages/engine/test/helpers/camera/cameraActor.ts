// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { Transform } from "../../../src/core/actor/transform/Transform.ts";
import { ActorComponents } from "../../../src/core/actor/ActorComponents.ts";
import { ActorRegistry } from "../../../src/core/systems/scene/ActorRegistry.ts";
import type { Actor } from "../../../src/core/actor/Actor.ts";
import { ThreeSceneGraph } from "../../../src/three/scene/ThreeSceneGraph.ts";
import { GlobalAudio } from "../../../src/three/audio/GlobalAudio.ts";
import { installFakeAudioContext } from "../audio/FakeAudioContext.ts";

function createRendererMock() {
  return {
    addRenderComponent: mock.fn(),
    removeRenderComponent: mock.fn()
  };
}

export function createActorMock() {
  installFakeAudioContext();
  const graph = new ThreeSceneGraph();
  const node = graph.createNode({} as Actor);
  const transform = new Transform(node).attach(null);

  return {
    object3D: node.object3D,
    transform,
    components: new ActorComponents(),
    world: {
      time: {
        delta: 0.1,
        unscaledDelta: 0.1
      },
      renderer: createRendererMock(),
      audio: new GlobalAudio(),
      sceneManager: {
        actors: new ActorRegistry(graph)
      },
      input: {
        getMouseDelta: mock.fn(() => {
          return { x: 0, y: 0 };
        }),
        keyboard: {
          isDown: mock.fn((_key: string) => false)
        },
        mouse: {
          isDown: mock.fn(() => false),
          wasJustReleased: mock.fn(() => false)
        }
      }
    }
  };
}

export type ActorMock = ReturnType<typeof createActorMock>;
