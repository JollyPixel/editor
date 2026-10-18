// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TurntablePose
} from "../../../src/features/preview/TurntablePose.ts";
import {
  PREVIEW_REST_ANGLE
} from "../../../src/features/preview/PreviewStage.ts";

// CONSTANTS
const kQuarterTurn = Math.PI / 2;
const kFrameMs = 100;

describe("TurntablePose", () => {
  it("spins by elapsed time whatever the frame rate", () => {
    const fast = new TurntablePose();
    const slow = new TurntablePose();
    for (let frame = 0; frame < 12; frame++) {
      fast.advance(1000 / 120);
    }
    for (let frame = 0; frame < 6; frame++) {
      slow.advance(1000 / 60);
    }

    assert.ok(fast.yaw > PREVIEW_REST_ANGLE.yaw);
    assert.ok(Math.abs(fast.yaw - slow.yaw) < 1e-9);
  });

  it("caps a long pause between frames", () => {
    const pose = new TurntablePose();
    const capped = new TurntablePose();

    pose.advance(60_000);
    capped.advance(100);

    assert.equal(pose.yaw, capped.yaw);
  });

  it("stops spinning and stays still once dragged", () => {
    const pose = new TurntablePose();

    pose.turn(0.5, 0.1);

    assert.equal(pose.spinning, false);
    assert.equal(pose.yaw, PREVIEW_REST_ANGLE.yaw + 0.5);
    assert.equal(pose.pitch, PREVIEW_REST_ANGLE.pitch + 0.1);
    pose.advance(16);
    assert.equal(pose.yaw, PREVIEW_REST_ANGLE.yaw + 0.5);
  });

  it("clamps the pitch between the bottom and top faces", () => {
    const pose = new TurntablePose();

    pose.turn(0, 10);
    assert.equal(pose.pitch, kQuarterTurn);

    pose.turn(0, -20);
    assert.equal(pose.pitch, -kQuarterTurn);
  });

  it("steps from the corner view to the next face and eases into it", () => {
    const pose = new TurntablePose();

    pose.stepYaw(1);
    assert.equal(pose.spinning, false);
    pose.advance(16);
    assert.ok(pose.yaw > PREVIEW_REST_ANGLE.yaw && pose.yaw < kQuarterTurn);

    settle(pose);
    assert.equal(pose.yaw, kQuarterTurn);

    pose.stepYaw(-1);
    pose.stepYaw(-1);
    settle(pose);
    assert.equal(pose.yaw, -kQuarterTurn);
  });

  it("steps the pitch to face-on, then to the top or bottom face", () => {
    const pose = new TurntablePose();

    pose.stepPitch(-1);
    settle(pose);
    assert.equal(pose.pitch, 0);

    pose.stepPitch(-1);
    pose.stepPitch(-1);
    settle(pose);
    assert.equal(pose.pitch, -kQuarterTurn);

    pose.stepPitch(1);
    pose.stepPitch(1);
    pose.stepPitch(1);
    settle(pose);
    assert.equal(pose.pitch, kQuarterTurn);
  });

  it("resumes spinning from where it was paused", () => {
    const pose = new TurntablePose();
    pose.turn(1, 0.2);

    pose.toggle();
    pose.advance(50);

    assert.equal(pose.spinning, true);
    assert.ok(pose.yaw > PREVIEW_REST_ANGLE.yaw + 1);
    assert.equal(pose.pitch, PREVIEW_REST_ANGLE.pitch + 0.2);
  });

  it("resets to the spinning corner view", () => {
    const pose = new TurntablePose();
    pose.turn(1, 1);

    pose.reset();

    assert.equal(pose.spinning, true);
    assert.equal(pose.yaw, PREVIEW_REST_ANGLE.yaw);
    assert.equal(pose.pitch, PREVIEW_REST_ANGLE.pitch);
  });
});

function settle(
  pose: TurntablePose
): void {
  for (let frame = 0; frame < 20; frame++) {
    pose.advance(kFrameMs);
  }
}
