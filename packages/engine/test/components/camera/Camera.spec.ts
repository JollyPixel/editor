// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { CameraComponent } from "../../../src/components/camera/Camera.ts";
import { Transform } from "../../../src/actor/Transform.ts";
import type { Actor } from "../../../src/actor/Actor.ts";

function createRendererMock() {
  return {
    addRenderComponent: mock.fn(),
    removeRenderComponent: mock.fn(),
    markRenderOrderDirty: mock.fn()
  };
}

function createActorMock() {
  const parent = new THREE.Scene();
  const object3D = new THREE.Group();
  parent.add(object3D);

  return {
    object3D,
    transform: new Transform(object3D),
    components: [],
    componentsRequiringUpdate: [],
    world: {
      time: {
        delta: 0.1,
        unscaledDelta: 0.1
      },
      renderer: createRendererMock(),
      audio: { threeAudioListener: new THREE.Object3D() },
      sceneManager: {
        scheduleStart: () => void 0,
        cancelStart: () => void 0
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

type ActorMock = ReturnType<typeof createActorMock>;

function createOutputNode() {
  return new THREE.Node();
}

describe("Components.Camera.CameraComponent", () => {
  let actor: ActorMock;

  beforeEach(() => {
    actor = createActorMock();
  });

  describe("actor-driven transform", () => {
    test("should stop three from recomposing the camera matrix", () => {
      const camera = new CameraComponent(actor as unknown as Actor);

      assert.strictEqual(
        camera.threeCamera.matrixWorldAutoUpdate,
        false,
        "three would otherwise overwrite matrixWorld from the camera's own local transform"
      );
    });

    test("should take its world matrix from the actor", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      actor.transform.setLocalPosition({ x: 3, y: 4, z: 5 });

      camera.prepareRender(800, 600);

      assert.deepStrictEqual(
        camera.threeCamera.matrixWorld.elements,
        actor.object3D.matrixWorld.elements
      );
    });

    test("should mirror the actor pose into position and quaternion", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      actor.transform
        .setLocalPosition({ x: 10, y: 2, z: -4 })
        .lookAt({ x: 0, y: 0, z: 0 });

      camera.prepareRender(800, 600);

      const { position } = camera.threeCamera;
      assert.deepStrictEqual(
        [position.x, position.y, position.z],
        [10, 2, -4]
      );
      assert.ok(
        camera.threeCamera.quaternion.angleTo(actor.object3D.quaternion) < 1e-6,
        "the camera must face the same way as the actor"
      );
    });

    test("should keep matrixWorldInverse consistent with matrixWorld", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      actor.transform.setLocalPosition({ x: 7, y: 0, z: 1 });

      camera.prepareRender(800, 600);

      const identity = new THREE.Matrix4().multiplyMatrices(
        camera.threeCamera.matrixWorld,
        camera.threeCamera.matrixWorldInverse
      );
      assert.deepStrictEqual(
        identity.elements.map((value) => Math.round(value)),
        new THREE.Matrix4().elements
      );
    });

    test("should move attached listeners along with the camera", () => {
      const camera = new CameraComponent(actor as unknown as Actor, {
        addAudioListener: true
      });
      actor.transform.setLocalPosition({ x: 0, y: 12, z: 0 });

      camera.prepareRender(800, 600);

      const listener = camera.threeCamera.children[0];
      assert.strictEqual(
        new THREE.Vector3().setFromMatrixPosition(listener.matrixWorld).y,
        12,
        "matrixWorldAutoUpdate is off, so children must be updated explicitly"
      );
    });
  });

  describe("setProjectionMode()", () => {
    test("should carry the audio listener over to the new camera", () => {
      const camera = new CameraComponent(actor as unknown as Actor, {
        addAudioListener: true
      });
      const listener = camera.threeCamera.children[0];

      camera.setProjectionMode("orthographic");

      assert.strictEqual(camera.threeCamera.children.includes(listener), true);
      assert.strictEqual(listener.parent, camera.threeCamera);
    });

    test("should carry the layer mask over to the new camera", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      camera.threeCamera.layers.enable(3);
      const { mask } = camera.threeCamera.layers;

      camera.setProjectionMode("orthographic");

      assert.strictEqual(camera.threeCamera.layers.mask, mask);
    });

    test("should build the new camera as actor-driven too", () => {
      const camera = new CameraComponent(actor as unknown as Actor);

      camera.setProjectionMode("orthographic");

      assert.ok(camera.threeCamera instanceof THREE.OrthographicCamera);
      assert.strictEqual(camera.threeCamera.matrixWorldAutoUpdate, false);
    });

    test("should stay registered with the renderer under the new camera", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      camera.awake();

      camera.setProjectionMode("orthographic");

      const { addRenderComponent, removeRenderComponent } = actor.world.renderer;
      assert.strictEqual(addRenderComponent.mock.callCount(), 1);
      assert.strictEqual(removeRenderComponent.mock.callCount(), 0);
      assert.ok(camera.threeCamera instanceof THREE.OrthographicCamera);
    });

    test("should be a no-op when the mode is unchanged", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      const { threeCamera } = camera;

      camera.setProjectionMode("perspective");

      assert.strictEqual(camera.threeCamera, threeCamera);
    });
  });

  describe("destroy()", () => {
    test("should unregister from the renderer once", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      camera.awake();

      camera.destroy();
      camera.destroy();

      const { removeRenderComponent } = actor.world.renderer;
      assert.strictEqual(removeRenderComponent.mock.callCount(), 1);
      assert.strictEqual(removeRenderComponent.mock.calls[0].arguments[0], camera);
    });

    test("should stop invalidating the render order after destroy", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      camera.awake();
      camera.destroy();

      camera.setDepth(3);

      assert.strictEqual(
        actor.world.renderer.markRenderOrderDirty.mock.callCount(),
        0
      );
    });
  });

  describe("setDepth()", () => {
    test("should invalidate the renderer's cached order", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      camera.awake();

      camera.setDepth(5);

      assert.strictEqual(camera.depth, 5);
      assert.strictEqual(
        actor.world.renderer.markRenderOrderDirty.mock.callCount(),
        1
      );
    });

    test("should not touch a renderer it was never registered with", () => {
      const camera = new CameraComponent(actor as unknown as Actor);

      camera.setDepth(5);

      assert.strictEqual(
        actor.world.renderer.markRenderOrderDirty.mock.callCount(),
        0
      );
    });
  });

  describe("postProcessing", () => {
    test("should default to a direct render", () => {
      const camera = new CameraComponent(actor as unknown as Actor);

      assert.strictEqual(camera.postProcessing, null);
    });

    test("should take the post-processing from the options", () => {
      const postProcessing = createOutputNode;
      const camera = new CameraComponent(
        actor as unknown as Actor,
        { postProcessing }
      );

      assert.strictEqual(camera.postProcessing, postProcessing);
    });

    test("should replace and clear the post-processing", () => {
      const postProcessing = createOutputNode;
      const camera = new CameraComponent(actor as unknown as Actor);

      camera.postProcessing = postProcessing;
      assert.strictEqual(camera.postProcessing, postProcessing);

      camera.postProcessing = null;
      assert.strictEqual(camera.postProcessing, null);
    });
  });
});
