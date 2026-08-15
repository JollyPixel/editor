// Import Node.js Dependencies
import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { CameraComponent } from "../../../src/components/camera/Camera.ts";
import { Camera3DControls } from "../../../src/components/camera/Camera3DControls.ts";
import { Transform } from "../../../src/actor/Transform.ts";
import type { Actor } from "../../../src/actor/Actor.ts";

function createRendererMock() {
  return {
    addRenderComponent: mock.fn(),
    removeRenderComponent: mock.fn(),
    updateRenderComponent: mock.fn(),
    markRenderOrderDirty: mock.fn()
  };
}

function createActorMock() {
  // A parent keeps global transform helpers working, exactly like a root actor
  // added to the scene graph by SceneManager.
  const parent = new THREE.Scene();
  const object3D = new THREE.Group();
  parent.add(object3D);

  return {
    object3D,
    transform: new Transform(object3D),
    components: [],
    componentsRequiringUpdate: [],
    world: {
      renderer: createRendererMock(),
      audio: { threeAudioListener: new THREE.Object3D() },
      sceneManager: { componentsToBeStarted: [] },
      input: {
        getMouseDelta: mock.fn(() => {
          return { x: 0, y: 0 };
        }),
        keyboard: {
          isDown: mock.fn(() => false)
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

    test("should tell the renderer to rebind, so passes stop pointing at the old camera", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      camera.awake();

      camera.setProjectionMode("orthographic");

      const { updateRenderComponent } = actor.world.renderer;
      assert.strictEqual(updateRenderComponent.mock.callCount(), 1);
      assert.strictEqual(
        updateRenderComponent.mock.calls[0].arguments[0],
        camera
      );
    });

    test("should not notify a renderer it was never registered with", () => {
      const camera = new CameraComponent(actor as unknown as Actor);

      camera.setProjectionMode("orthographic");

      assert.strictEqual(
        actor.world.renderer.updateRenderComponent.mock.callCount(),
        0
      );
    });

    test("should be a no-op when the mode is unchanged", () => {
      const camera = new CameraComponent(actor as unknown as Actor);
      const { threeCamera } = camera;

      camera.setProjectionMode("perspective");

      assert.strictEqual(camera.threeCamera, threeCamera);
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
});

describe("Components.Camera.Camera3DControls", () => {
  let actor: ActorMock;

  beforeEach(() => {
    actor = createActorMock();
  });

  describe("camera options", () => {
    test("should forward the clipping planes instead of dropping them", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        near: 2,
        far: 4096
      });

      assert.strictEqual(controls.near, 2);
      assert.strictEqual(controls.far, 4096);
      assert.strictEqual(controls.camera.far, 4096);
    });

    test("should forward the field of view", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        fov: 75
      });

      assert.strictEqual(controls.fov, 75);
      assert.strictEqual(controls.camera.fov, 75);
    });

    test("should forward the projection mode", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        projectionMode: "orthographic",
        orthographicScale: 12
      });

      assert.strictEqual(controls.projectionMode, "orthographic");
      assert.strictEqual(controls.orthographicScale, 12);
      assert.ok(controls.threeCamera instanceof THREE.OrthographicCamera);
    });

    test("should forward depth and viewport", () => {
      const viewport = { x: 0, y: 0, width: 0.5, height: 1 };
      const controls = new Camera3DControls(actor as unknown as Actor, {
        depth: 3,
        viewport
      });

      assert.strictEqual(controls.depth, 3);
      assert.deepStrictEqual(controls.viewport, viewport);
    });

    test("should attach an audio listener by default", () => {
      const controls = new Camera3DControls(actor as unknown as Actor);

      assert.strictEqual(controls.threeCamera.children.length, 1);
    });

    test("should let the caller opt out of the audio listener", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        addAudioListener: false
      });

      assert.strictEqual(controls.threeCamera.children.length, 0);
    });
  });

  describe("update()", () => {
    test("should move the actor, not the three camera", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        speed: 10
      });
      actor.world.input.keyboard.isDown.mock.mockImplementation(
        (key: string) => key === "KeyW"
      );

      controls.update(0.1);

      assert.strictEqual(
        Math.round(actor.transform.getLocalPosition().z * 100) / 100,
        -1,
        "forward is -Z: speed 10 for 0.1s"
      );
    });

    test("should move vertically in world space", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        speed: 10
      });
      actor.world.input.keyboard.isDown.mock.mockImplementation(
        (key: string) => key === "Space"
      );

      controls.update(0.1);

      assert.strictEqual(
        Math.round(actor.transform.getGlobalPosition().y * 100) / 100,
        1
      );
    });

    test("should stay put when no key is down", () => {
      const controls = new Camera3DControls(actor as unknown as Actor);

      controls.update(0.1);

      assert.deepStrictEqual(
        actor.transform.getLocalPosition().toArray(),
        [0, 0, 0],
        "normalizing a zero movement vector must not produce NaN"
      );
    });
  });
});
