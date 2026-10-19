// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { createHarness, unusedPostProcessing } from "../../helpers/orbitFlyHarness.ts";
import type {
  PostProcessing
} from "../../../src/systems/rendering/PostProcessing.ts";

describe("OrbitFlyCamera vertical movement", () => {
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

describe("OrbitFlyCamera acceleration", () => {
  function frameSpeeds(
    harness: ReturnType<typeof createHarness>,
    frames: number
  ): number[] {
    const speeds: number[] = [];
    for (let index = 0; index < frames; index++) {
      const before = harness.offset.z;
      harness.advance();
      speeds.push(Math.abs(harness.offset.z - before) * 60);
    }

    return speeds;
  }

  function brakingDrift(
    brakingTime: number
  ): number {
    const harness = createHarness({ brakingTime });
    harness.hold("KeyW");
    harness.advance(60);
    const released = harness.offset.z;
    harness.hold();
    harness.advance(120);

    return Math.abs(harness.offset.z - released);
  }

  test("builds acceleration up instead of peaking on the first frame", () => {
    const harness = createHarness();

    harness.hold("KeyW");
    const [first, second] = frameSpeeds(harness, 2);

    assert.ok(
      second - first > first,
      `speed rose by ${first} then ${second - first}`
    );
  });

  test("reaches moveSpeed after a held second", () => {
    const harness = createHarness({ moveSpeed: 10 });

    harness.hold("KeyW");
    harness.advance(60);
    const [speed] = frameSpeeds(harness, 1);

    assert.ok(Math.abs(speed - 10) < 0.01, `cruising at ${speed}`);
  });

  test("starts at full speed when accelerationTime is 0", () => {
    const harness = createHarness({
      moveSpeed: 10,
      accelerationTime: 0
    });

    harness.hold("KeyW");
    const [speed] = frameSpeeds(harness, 1);

    assert.ok(Math.abs(speed - 10) < 1e-9, `first frame at ${speed}`);
  });

  test("glides further after release as brakingTime grows", () => {
    const drifts = [0, 0.1, 0.3].map(brakingDrift);

    assert.equal(drifts[0], 0);
    assert.ok(
      drifts[0] < drifts[1] && drifts[1] < drifts[2],
      `drifts were ${drifts.join(", ")}`
    );
  });

  test("covers the same distance at any frame rate", () => {
    const distances = [30, 60, 144].map((fps) => {
      const harness = createHarness();
      harness.hold("KeyW");
      harness.advance(fps / 2, 1 / fps);
      harness.hold();
      harness.advance(fps / 2, 1 / fps);

      return Math.abs(harness.offset.z);
    });

    for (const distance of distances) {
      assert.ok(
        Math.abs(distance - distances[1]) < distances[1] * 0.01,
        `distances were ${distances.join(", ")}`
      );
    }
  });
});

describe("OrbitFlyCamera focus mode \"none\"", () => {
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

describe("OrbitFlyCamera options", () => {
  test("elastic focus creates no marker when showPivotMarker is false", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 },
      initialTrailDistance: 12,
      showPivotMarker: false
    });

    assert.equal(harness.camera.isOrbiting, true);
    assert.equal(harness.sceneChildren.length, 0);

    harness.scroll(-10);
    harness.advance();
    harness.scroll(0);
    assert.equal(harness.sceneChildren.length, 0);
  });

  test("fov defaults to 60 and is configurable", () => {
    assert.equal(createHarness().camera.fov, 60);
    assert.equal(createHarness({ fov: 45 }).camera.fov, 45);
  });

  test("far defaults to 2000 and camera options are forwarded", () => {
    assert.equal(createHarness().camera.far, 2000);

    const postProcessing: PostProcessing = unusedPostProcessing;
    const viewport = { x: 0, y: 0, width: 0.5, height: 1 };
    const { camera } = createHarness({
      near: 0.5, far: 500, depth: 2, viewport, postProcessing
    });

    assert.deepEqual(
      [camera.near, camera.far, camera.depth, camera.viewport],
      [0.5, 500, 2, viewport]
    );
    assert.equal(camera.postProcessing, postProcessing);
  });
});
