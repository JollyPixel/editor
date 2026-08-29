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
import { FreeFlyCamera } from "../../src/components/FreeFlyCamera.ts";

// CONSTANTS
const kFrame = 1 / 60;

interface CameraHarness {
  camera: FreeFlyCamera;
  offset: THREE.Vector3;
  hold(...codes: string[]): void;
  advance(frames?: number): void;
}

function createHarness(): CameraHarness {
  const held = new Set<string>();
  const offset = new THREE.Vector3();

  const actorValue = {
    components: [],
    componentsRequiringUpdate: [],
    transform: {
      setLocalPosition: () => void 0,
      setLocalOrientation: () => void 0,
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
