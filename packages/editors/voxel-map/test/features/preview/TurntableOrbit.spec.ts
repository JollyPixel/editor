// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TurntableOrbit
} from "../../../src/features/preview/TurntableOrbit.ts";
import {
  TurntablePose
} from "../../../src/features/preview/TurntablePose.ts";

// CONSTANTS
const kQuarterTurn = Math.PI / 2;

function setup() {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const pose = new TurntablePose();
  new TurntableOrbit(canvas, pose);

  return {
    canvas,
    pose
  };
}

function settle(
  pose: TurntablePose
): void {
  for (let frame = 0; frame < 20; frame++) {
    pose.advance(100);
  }
}

function pointer(
  type: string,
  pointerId: number,
  clientX: number
): PointerEvent {
  return new PointerEvent(type, {
    pointerId,
    clientX,
    clientY: 0,
    button: 0,
    bubbles: true
  });
}

describe("TurntableOrbit", () => {
  it("turns the arrow keys into face steps", () => {
    const cases = [
      ["ArrowRight", "yaw", kQuarterTurn],
      ["ArrowLeft", "yaw", 0],
      ["ArrowUp", "pitch", 0],
      ["ArrowDown", "pitch", kQuarterTurn]
    ] as const;

    for (const [key, axis, expected] of cases) {
      const { canvas, pose } = setup();
      const event = new KeyboardEvent("keydown", {
        key,
        cancelable: true
      });

      canvas.dispatchEvent(event);
      settle(pose);

      assert.equal(pose[axis], expected, key);
      assert.equal(event.defaultPrevented, true, key);
    }
  });

  it("pauses on press and turns only with the pointer that pressed", () => {
    const { canvas, pose } = setup();
    const startYaw = pose.yaw;

    canvas.dispatchEvent(pointer("pointerdown", 1, 0));
    assert.equal(pose.spinning, false);

    canvas.dispatchEvent(pointer("pointermove", 2, 50));
    assert.equal(pose.yaw, startYaw);

    canvas.dispatchEvent(pointer("pointermove", 1, 50));
    assert.ok(pose.yaw > startYaw);

    const turnedYaw = pose.yaw;
    canvas.dispatchEvent(pointer("pointerup", 1, 50));
    canvas.dispatchEvent(pointer("pointermove", 1, 100));
    assert.equal(pose.yaw, turnedYaw);
  });
});
