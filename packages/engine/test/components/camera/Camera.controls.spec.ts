// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Camera3DControls } from "../../../src/components/camera/Camera3DControls.ts";
import type { Actor } from "../../../src/actor/Actor.ts";
import {
  createActorMock,
  type ActorMock
} from "../../helpers/camera/cameraActor.ts";
import { Viewport } from "../../../src/systems/rendering/Viewport.ts";

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

      assert.strictEqual(controls.settings.near, 2);
      assert.strictEqual(controls.settings.far, 4096);
      assert.strictEqual(controls.camera.far, 4096);
    });

    test("should forward the field of view", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        fov: 75
      });

      assert.strictEqual(controls.settings.fov, 75);
      assert.strictEqual(controls.camera.fov, 75);
    });

    test("should forward the projection mode", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        projectionMode: "orthographic",
        orthographicScale: 12
      });

      assert.strictEqual(controls.settings.projectionMode, "orthographic");
      assert.strictEqual(controls.settings.orthographicScale, 12);
      assert.ok(controls.threeCamera instanceof THREE.OrthographicCamera);
    });

    test("should forward depth and viewport", () => {
      const viewport = { x: 0, y: 0, width: 0.5, height: 1 };
      const controls = new Camera3DControls(actor as unknown as Actor, {
        depth: 3,
        viewport
      });

      assert.strictEqual(controls.depth, 3);
      assert.deepStrictEqual(controls.viewport, new Viewport(viewport));
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

      controls.update();

      assert.strictEqual(
        Math.round(actor.transform.getLocalPosition().z * 100) / 100,
        -1,
        "forward is -Z: speed 10 for 0.1s"
      );
    });

    test("should keep moving while game time is paused", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        speed: 10
      });
      actor.world.time.delta = 0;
      actor.world.input.keyboard.isDown.mock.mockImplementation(
        (key: string) => key === "KeyW"
      );

      controls.update();

      assert.strictEqual(
        Math.round(actor.transform.getLocalPosition().z * 100) / 100,
        -1
      );
    });

    test("should move vertically in world space", () => {
      const controls = new Camera3DControls(actor as unknown as Actor, {
        speed: 10
      });
      actor.world.input.keyboard.isDown.mock.mockImplementation(
        (key: string) => key === "Space"
      );

      controls.update();

      assert.strictEqual(
        Math.round(actor.transform.getGlobalPosition().y * 100) / 100,
        1
      );
    });

    test("should stay put when no key is down", () => {
      const controls = new Camera3DControls(actor as unknown as Actor);

      controls.update();

      assert.deepStrictEqual(
        actor.transform.getLocalPosition().toArray(),
        [0, 0, 0],
        "normalizing a zero movement vector must not produce NaN"
      );
    });
  });
});
