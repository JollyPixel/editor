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
import {
  FreeFlyCamera,
  type FreeFlyCameraFocusMode
} from "../../../src/scene/camera/FreeFlyCamera.ts";

// CONSTANTS
const kFrame = 1 / 60;
const kUp = new THREE.Vector3(0, 1, 0);

function pivotArray(
  pivot: THREE.Vector3Like | null
): [number, number, number] | null {
  return pivot === null ? null : [pivot.x, pivot.y, pivot.z];
}

interface CameraHarness {
  camera: FreeFlyCamera;
  offset: THREE.Vector3;
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
  sceneChildren: THREE.Object3D[];
  hold(...codes: string[]): void;
  advance(frames?: number): void;
  lookDrag(deltaX: number, deltaY: number, button?: "middle" | "left"): void;
  stopLookDrag(): void;
  scroll(amount: number): void;
  pressOnce(...codes: string[]): void;
}

interface CameraHarnessOptions {
  focusMode?: FreeFlyCameraFocusMode;
  minPivotDistance?: number;
  maxPivotDistance?: number;
  position?: THREE.Vector3Like;
}

function createHarness(
  options: CameraHarnessOptions = {}
): CameraHarness {
  const held = new Set<string>();
  const offset = new THREE.Vector3();
  const position = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const sceneRoot = new THREE.Object3D();
  const lookMatrix = new THREE.Matrix4();

  let middleDown = false;
  let leftDown = false;
  let mouseMoving = false;
  let mouseDelta = { x: 0, y: 0 };
  let scrollY = 0;
  let justPressed = new Set<string>();

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
      getGlobalPosition: (out: THREE.Vector3) => out.copy(position),
      lookAt: (target: THREE.Vector3Like) => {
        lookMatrix.lookAt(position, new THREE.Vector3(target.x, target.y, target.z), kUp);
        orientation.setFromRotationMatrix(lookMatrix);
      },
      moveGlobal: (delta: THREE.Vector3) => {
        offset.add(delta);
        position.add(delta);
      }
    },
    world: {
      audio: {},
      renderer: {
        addRenderComponent: () => void 0,
        removeRenderComponent: () => void 0
      },
      input: {
        keyboard: {
          isDown: (code: string) => held.has(code),
          wasJustPressed: (code: string) => justPressed.has(code)
        },
        mouse: {
          isDown: (button: string) => {
            if (button === "middle") {
              return middleDown;
            }

            return button === "left" && leftDown;
          },
          isMoving: () => mouseMoving,
          viewportDelta: () => {
            return { x: mouseDelta.x, y: mouseDelta.y };
          },
          scrollTo: <T extends { x: number; y: number; }>(out: T) => {
            out.x = 0;
            out.y = scrollY;

            return out;
          }
        }
      },
      sceneManager: {
        componentsToBeStarted: [],
        getSource: () => sceneRoot
      }
    }
  };
  const actor = actorValue as unknown as Actor;
  const camera = new FreeFlyCamera(actor, options);

  return {
    camera,
    offset,
    position,
    orientation,
    sceneChildren: sceneRoot.children,
    hold(...codes: string[]): void {
      held.clear();
      for (const code of codes) {
        held.add(code);
      }
    },
    advance(frames = 1): void {
      for (let index = 0; index < frames; index++) {
        camera.update(kFrame);
        justPressed.clear();
      }
    },
    lookDrag(deltaX: number, deltaY: number, button: "middle" | "left" = "middle"): void {
      if (button === "middle") {
        middleDown = true;
      }
      else {
        leftDown = true;
      }
      mouseMoving = true;
      mouseDelta = { x: deltaX, y: deltaY };
    },
    stopLookDrag(): void {
      middleDown = false;
      leftDown = false;
      mouseMoving = false;
      mouseDelta = { x: 0, y: 0 };
    },
    scroll(amount: number): void {
      scrollY = amount;
    },
    pressOnce(...codes: string[]): void {
      justPressed = new Set(codes);
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

describe("FreeFlyCamera Alt+LeftClick look", () => {
  test("rotates in free-fly, like middle-drag", () => {
    const harness = createHarness();
    const startOrientation = harness.orientation.clone();

    harness.hold("AltLeft");
    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();
    harness.hold();

    assert.ok(
      harness.orientation.angleTo(startOrientation) > 1e-3,
      "the camera did not rotate"
    );
  });

  test("plain LeftClick-drag (no Alt) does not rotate the camera", () => {
    const harness = createHarness();
    const startOrientation = harness.orientation.clone();

    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();

    assert.deepEqual(
      harness.orientation.toArray(),
      startOrientation.toArray()
    );
  });

  test("orbits around the pivot while locked, like middle-drag", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    const distance = harness.position.distanceTo(pivot);

    harness.hold("AltLeft");
    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();
    harness.hold();

    assert.ok(
      Math.abs(harness.position.distanceTo(pivot) - distance) < 1e-3,
      "distance to the pivot drifted while orbiting"
    );
  });
});

describe("FreeFlyCamera focus mode \"none\"", () => {
  test("scroll adjusts moveSpeed instead of dollying", () => {
    const harness = createHarness({ focusMode: "none" });
    const startPosition = harness.position.clone();

    harness.scroll(1);
    harness.advance();

    assert.deepEqual(harness.position.toArray(), startPosition.toArray());
    assert.ok(harness.camera.moveSpeed > 18, "moveSpeed did not increase");
  });

  test("ignores enterOrbitFocus entirely", () => {
    const harness = createHarness({ focusMode: "none" });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });

    assert.equal(harness.camera.isOrbiting, false);
    assert.equal(harness.camera.orbitPivot, null);
  });
});

describe("FreeFlyCamera orbit focus (lock)", () => {
  test("enterOrbitFocus immediately faces the given point", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(5, 0, 0);

    assert.equal(harness.camera.isOrbiting, false);

    harness.camera.enterOrbitFocus(pivot);
    assert.equal(harness.camera.isOrbiting, true);

    const toPivot = pivot.clone().sub(harness.position).normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(harness.orientation);
    assert.ok(toPivot.angleTo(forward) < 1e-3, "the camera did not face the pivot on entry");
  });

  test("exitOrbitFocus does not move or reorient the camera", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 5, y: 0, z: 0 });
    const settledPosition = harness.position.clone();
    const settledOrientation = harness.orientation.clone();

    harness.camera.exitOrbitFocus();
    assert.equal(harness.camera.isOrbiting, false);
    assert.deepEqual(harness.position.toArray(), settledPosition.toArray());
    assert.ok(harness.orientation.angleTo(settledOrientation) < 1e-6);
  });

  test("scroll adjusts moveSpeed before any pivot has ever been engaged", () => {
    const harness = createHarness({ focusMode: "lock" });
    const startPosition = harness.position.clone();

    harness.scroll(1);
    harness.advance();

    assert.deepEqual(harness.position.toArray(), startPosition.toArray());
    assert.ok(harness.camera.moveSpeed > 18, "moveSpeed did not increase");
  });

  test("scroll stops adjusting moveSpeed once a pivot has been engaged", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });
    const speedBefore = harness.camera.moveSpeed;

    harness.scroll(1);
    harness.advance();

    assert.equal(harness.camera.moveSpeed, speedBefore, "moveSpeed changed while orbiting");
  });

  test("middle-drag orbits around the pivot at a constant distance", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    const distance = harness.position.distanceTo(pivot);

    harness.lookDrag(80, 0);
    harness.advance(5);
    harness.stopLookDrag();

    assert.ok(
      Math.abs(harness.position.distanceTo(pivot) - distance) < 1e-3,
      "distance to the pivot drifted while orbiting"
    );

    const toPivot = pivot.clone().sub(harness.position).normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(harness.orientation);
    assert.ok(toPivot.angleTo(forward) < 1e-3, "the camera did not face the pivot");
  });

  test("scroll adjusts pivot distance and clamps instead of releasing", () => {
    const harness = createHarness({
      focusMode: "lock",
      minPivotDistance: 2,
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);

    harness.scroll(1000);
    harness.advance();
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, true, "scrolling in released the lock");
    assert.ok(
      harness.position.distanceTo(pivot) >= 2 - 1e-6,
      "distance dropped below the minimum"
    );

    harness.scroll(-1000);
    harness.advance();
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, true);
    assert.ok(
      harness.position.distanceTo(pivot) <= 20 + 1e-6,
      "distance exceeded the maximum"
    );
  });

  test("only exitOrbitFocus releases the lock", () => {
    const harness = createHarness({
      focusMode: "lock",
      minPivotDistance: 2,
      position: { x: 0, y: 0, z: 0 }
    });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    harness.scroll(1000);
    harness.advance(20);
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, true);

    harness.camera.exitOrbitFocus();
    assert.equal(harness.camera.isOrbiting, false);
  });
});

describe("FreeFlyCamera orbit focus (elastic)", () => {
  test("starts fully zoomed in, with the camera matching the pivot exactly", () => {
    const harness = createHarness({
      focusMode: "elastic",
      position: { x: 3, y: 4, z: 5 }
    });

    assert.equal(harness.camera.isOrbiting, false);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [3, 4, 5]);
    assert.deepEqual(harness.position.toArray(), [3, 4, 5]);
  });

  test("WASD moves the pivot, and the camera follows it at zero trail distance", () => {
    const harness = createHarness({ focusMode: "elastic", position: { x: 0, y: 0, z: 0 } });

    harness.hold("KeyD");
    harness.advance(20);
    harness.hold();

    assert.ok(harness.position.lengthSq() > 0, "the camera did not move");
    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.ok(
      harness.position.distanceTo(new THREE.Vector3(pivot.x, pivot.y, pivot.z)) < 1e-9,
      "camera position diverged from the pivot at zero trail distance"
    );
  });

  test("scrolling out increases trail distance and pulls the camera behind the pivot", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });

    harness.scroll(-10);
    harness.advance();
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, true, "did not start trailing");
    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    const distance = harness.position.distanceTo(new THREE.Vector3(pivot.x, pivot.y, pivot.z));
    assert.ok(distance > 0 && distance <= 20 + 1e-6, `unexpected trail distance ${distance}`);
  });

  test("scrolling fully back in returns to a zero trail distance", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });

    harness.scroll(-10);
    harness.advance(100);
    harness.scroll(1000);
    harness.advance(100);
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, false);
    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.ok(
      harness.position.distanceTo(new THREE.Vector3(pivot.x, pivot.y, pivot.z)) < 1e-6
    );
  });

  test("mouse-look orbits the camera around the pivot without moving the pivot", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });

    harness.scroll(-10);
    harness.advance(100);
    harness.scroll(0);
    const pivotBefore = harness.camera.orbitPivot as THREE.Vector3Like;
    const positionBefore = harness.position.clone();

    harness.lookDrag(80, 0);
    harness.advance(5);
    harness.stopLookDrag();

    const pivotAfter = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.deepEqual(pivotArray(pivotAfter), pivotArray(pivotBefore), "the pivot moved from mouse-look alone");
    assert.ok(
      harness.position.distanceTo(positionBefore) > 1e-3,
      "the camera did not move while looking around"
    );

    const distanceToPivot = harness.position.distanceTo(
      new THREE.Vector3(pivotAfter.x, pivotAfter.y, pivotAfter.z)
    );
    assert.ok(Math.abs(distanceToPivot - 20) < 1e-3, `distance to pivot drifted: ${distanceToPivot}`);
  });

  test("enterOrbitFocus and exitOrbitFocus are no-ops", () => {
    const harness = createHarness({ focusMode: "elastic", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 5, y: 0, z: 0 });
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, 0]);

    harness.camera.exitOrbitFocus();
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, 0]);
  });

  test("the marker appears once trailing and hides back at zero", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });

    assert.equal(harness.sceneChildren.length, 0);

    harness.scroll(-10);
    harness.advance();
    harness.scroll(0);
    assert.equal(harness.sceneChildren.length, 1);
    assert.equal(harness.sceneChildren[0].visible, true);

    harness.scroll(1000);
    harness.advance();
    harness.scroll(0);
    assert.equal(harness.sceneChildren[0].visible, false);
  });
});

describe("FreeFlyCamera orbit focus rig movement", () => {
  test("WASD does not move the camera while orbiting", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);

    harness.hold("KeyD");
    harness.advance(20);
    harness.hold();

    assert.equal(harness.offset.lengthSq(), 0, "the camera moved while locked onto the pivot");
  });

  test("movement resumes once the pivot is released", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });
    harness.hold("KeyD");
    harness.advance(20);
    harness.hold();
    assert.equal(harness.offset.lengthSq(), 0);

    harness.camera.exitOrbitFocus();
    harness.hold("KeyD");
    harness.advance(20);
    harness.hold();

    assert.ok(harness.offset.lengthSq() > 0, "the camera did not resume moving after release");
  });
});

describe("FreeFlyCamera orbit focus reselection", () => {
  test("enterOrbitFocus is a no-op while already orbiting", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const firstPivot = { x: 0, y: 0, z: -10 };

    harness.camera.enterOrbitFocus(firstPivot);
    harness.camera.enterOrbitFocus({ x: 20, y: 0, z: 0 });

    assert.deepEqual(pivotArray(harness.camera.orbitPivot), pivotArray(firstPivot));
  });

  test("accepts a new point again once exitOrbitFocus is called", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });
    harness.camera.exitOrbitFocus();
    harness.camera.enterOrbitFocus({ x: 20, y: 0, z: 0 });

    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [20, 0, 0]);
  });
});

describe("FreeFlyCamera orbit focus nudge", () => {
  test("a single key press steps the pivot and camera by one unit, keeping distance", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    const distanceBefore = harness.position.distanceTo(pivot);

    harness.pressOnce("KeyD");
    harness.advance(60);

    const nudgedPivot = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.deepEqual([nudgedPivot.x, nudgedPivot.y, nudgedPivot.z], [1, 0, -10]);
    assert.ok(
      Math.abs(harness.position.distanceTo(nudgedPivot as THREE.Vector3) - distanceBefore) < 1e-6,
      "distance to the pivot changed on nudge"
    );
  });

  test("only one nudge happens per key press, not per held frame", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });

    harness.pressOnce("KeyD");
    harness.advance(60);

    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.equal(pivot.x, 1, "the pivot kept stepping while the frame advanced");
  });

  test("forward/backward/up/down nudge along the expected axes", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });

    harness.pressOnce("KeyW");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, -11]);

    harness.pressOnce("KeyS");
    harness.advance(60);
    harness.pressOnce("KeyS");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, -9]);

    harness.pressOnce("Space");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 1, -9]);

    harness.pressOnce("ShiftLeft");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, -9]);
  });

  test("does nothing while not orbiting", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.pressOnce("KeyD");
    harness.advance();

    assert.equal(harness.camera.orbitPivot, null);
    assert.equal(harness.offset.lengthSq(), 0);
  });
});

describe("FreeFlyCamera orbit focus marker", () => {
  test("is created lazily, reused, and its visibility follows isOrbiting", () => {
    const harness = createHarness({ focusMode: "lock" });

    assert.equal(harness.sceneChildren.length, 0);

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -5 });
    assert.equal(harness.sceneChildren.length, 1);
    assert.equal(harness.sceneChildren[0].visible, true);

    harness.camera.exitOrbitFocus();
    assert.equal(harness.sceneChildren.length, 1, "the marker was removed instead of hidden");
    assert.equal(harness.sceneChildren[0].visible, false);

    const marker = harness.sceneChildren[0];
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -8 });
    assert.equal(harness.sceneChildren.length, 1, "a second marker was created");
    assert.equal(harness.sceneChildren[0], marker);
    assert.equal(harness.sceneChildren[0].visible, true);
  });

  test("is disposed and detached on destroy", () => {
    const harness = createHarness({ focusMode: "lock" });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -5 });
    assert.equal(harness.sceneChildren.length, 1);

    harness.camera.destroy();

    assert.equal(harness.sceneChildren.length, 0);
  });
});
