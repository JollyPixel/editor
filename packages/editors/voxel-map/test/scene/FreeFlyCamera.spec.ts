// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { FreeFlyCamera } from "../../src/scene/FreeFlyCamera.ts";

// CONSTANTS
const kFrame = 1 / 60;

interface CameraHarness {
  camera: FreeFlyCamera;
  offset: THREE.Vector3;
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
  hold(...codes: string[]): void;
  advance(frames?: number): void;
}

function createHarness(): CameraHarness {
  const held = new Set<string>();
  const offset = new THREE.Vector3();
  const position = new THREE.Vector3();
  const orientation = new THREE.Quaternion();

  const actorValue = {
    components: [],
    componentsRequiringUpdate: [],
    transform: {
      setLocalPosition: (value: THREE.Vector3Like) => {
        position.set(value.x, value.y, value.z);
      },
      setLocalOrientation: (value: THREE.QuaternionLike) => {
        orientation.set(value.x, value.y, value.z, value.w);
      },
      getForward: (out: THREE.Vector3) => out.set(0, 0, -1),
      moveGlobal: (delta: THREE.Vector3) => {
        offset.add(delta);
      }
    },
    world: {
      audio: {},
      input: {
        keyboard: {
          isDown: (code: string) => held.has(code)
        },
        mouse: {
          isDown: () => false,
          isMoving: () => false,
          scrollTo: <T extends { x: number; y: number; }>(out: T) => {
            out.x = 0;
            out.y = 0;

            return out;
          }
        }
      },
      sceneManager: {
        componentsToBeStarted: []
      }
    }
  };
  const actor = actorValue as unknown as Actor;
  const camera = new FreeFlyCamera(actor);

  return {
    camera,
    offset,
    position,
    orientation,
    hold(...codes: string[]): void {
      held.clear();
      for (const code of codes) {
        held.add(code);
      }
    },
    advance(frames = 1): void {
      for (let index = 0; index < frames; index++) {
        camera.update(kFrame);
      }
    }
  };
}

describe("FreeFlyCamera vertical movement", () => {
  test("descends while shift is held", () => {
    const harness = createHarness();

    harness.hold("ShiftLeft");
    harness.advance(10);

    assert.ok(harness.offset.y < 0, "the camera did not descend");
  });

  test("stands still while disabled", () => {
    const harness = createHarness();

    harness.camera.enabled = false;
    harness.hold("ShiftLeft");
    harness.advance(10);

    assert.equal(harness.offset.y, 0);
  });

  test("does not resume the descent on a shift held through a gizmo drag", () => {
    const harness = createHarness();

    harness.camera.enabled = false;
    harness.hold("ShiftLeft");
    harness.advance(10);

    harness.camera.enabled = true;
    harness.advance(10);

    assert.equal(harness.offset.y, 0);
  });

  test("descends again once shift is released and pressed anew", () => {
    const harness = createHarness();

    harness.camera.enabled = false;
    harness.hold("ShiftLeft");
    harness.advance();

    harness.camera.enabled = true;
    harness.advance();
    harness.hold();
    harness.advance();
    harness.hold("ShiftLeft");
    harness.advance(10);

    assert.ok(harness.offset.y < 0, "the camera stayed latched");
  });
});

describe("FreeFlyCamera teleport", () => {
  test("adopts the pose position and orientation", () => {
    const harness = createHarness();
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3, 1.2, 0, "YXZ")
    );

    harness.camera.teleport({
      position: { x: 4, y: 5, z: 6 },
      quaternion
    });

    assert.deepEqual(harness.position.toArray(), [4, 5, 6]);
    assert.ok(
      harness.orientation.angleTo(quaternion) < 1e-6,
      "the camera kept a different orientation"
    );
  });

  test("keeps yaw and pitch so a later frame does not snap back", () => {
    const harness = createHarness();
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3, 1.2, 0, "YXZ")
    );

    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion
    });
    harness.advance(5);

    assert.ok(
      harness.orientation.angleTo(quaternion) < 1e-6,
      "the camera reverted to its former orientation"
    );
  });

  test("clamps a pitch steeper than the camera allows", () => {
    const harness = createHarness();

    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-1.57, 0, 0, "YXZ")
      )
    });

    const pitch = new THREE.Euler()
      .setFromQuaternion(harness.orientation, "YXZ").x;
    assert.ok(
      Math.abs(pitch) <= Math.PI / 2 - 0.01 + 1e-6,
      `the pitch stayed at ${pitch}`
    );
  });

  test("drops the momentum carried into the teleport", () => {
    const harness = createHarness();

    harness.hold("KeyW");
    harness.advance(10);
    harness.hold();
    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion: new THREE.Quaternion()
    });
    const settled = harness.offset.clone();
    harness.advance(10);

    assert.deepEqual(harness.offset.toArray(), settled.toArray());
  });
});
