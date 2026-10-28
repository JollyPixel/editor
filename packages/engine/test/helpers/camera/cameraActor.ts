// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Transform } from "../../../src/actor/Transform.ts";
import { ActorComponents } from "../../../src/actor/ActorComponents.ts";
import { ActorRegistry } from "../../../src/systems/scene/ActorRegistry.ts";

function createRendererMock() {
  return {
    addRenderComponent: mock.fn(),
    removeRenderComponent: mock.fn()
  };
}

export function createActorMock() {
  const parent = new THREE.Scene();
  const object3D = new THREE.Group();
  parent.add(object3D);

  return {
    object3D,
    transform: new Transform(object3D),
    components: new ActorComponents(),
    world: {
      time: {
        delta: 0.1,
        unscaledDelta: 0.1
      },
      renderer: createRendererMock(),
      audio: { threeAudioListener: new THREE.Object3D() },
      sceneManager: {
        actors: new ActorRegistry(parent)
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
