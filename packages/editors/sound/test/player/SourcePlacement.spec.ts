// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PlanePoint } from "#src/player/spatial/PlanePoint.ts";
import {
  SourcePlacement,
  type SourceMotion
} from "#src/player/spatial/SourcePlacement.ts";

// CONSTANTS
const kReach = 10;

function placed(
  motion: SourceMotion
): SourcePlacement {
  return new SourcePlacement({
    x: 0,
    z: -2,
    motion
  });
}

function rounded(
  point: PlanePoint
): PlanePoint {
  return {
    x: Math.round(point.x * 1e6) / 1e6 + 0,
    z: Math.round(point.z * 1e6) / 1e6 + 0
  };
}

describe("SourcePlacement", () => {
  for (const { title, motion, progress, expected } of [
    {
      title: "stays on the dot when still",
      motion: "still",
      progress: 0.5,
      expected: {
        x: 0,
        z: -2
      }
    },
    {
      title: "circles around the listener at the dot's distance",
      motion: "orbit",
      progress: 0.25,
      expected: {
        x: 2,
        z: 0
      }
    },
    {
      title: "starts a fly-by on the listener's left, as far as the reach",
      motion: "flyby",
      progress: 0,
      expected: {
        x: -10,
        z: -2
      }
    },
    {
      title: "passes through the dot halfway through a fly-by",
      motion: "flyby",
      progress: 0.5,
      expected: {
        x: 0,
        z: -2
      }
    },
    {
      title: "starts an approach as far as the reach, in the dot's direction",
      motion: "approach",
      progress: 0,
      expected: {
        x: 0,
        z: -10
      }
    },
    {
      title: "ends an approach on the dot",
      motion: "approach",
      progress: 1,
      expected: {
        x: 0,
        z: -2
      }
    }
  ] satisfies {
    title: string;
    motion: SourceMotion;
    progress: number;
    expected: PlanePoint;
  }[]) {
    test(title, () => {
      assert.deepEqual(
        rounded(placed(motion).pointAt(progress, kReach)),
        expected
      );
    });
  }

  test("approaches from straight ahead when the dot is on the listener", () => {
    const placement = new SourcePlacement({
      x: 0,
      z: 0,
      motion: "approach"
    });

    assert.deepEqual(rounded(placement.pointAt(0.5, kReach)), {
      x: 0,
      z: -5
    });
  });
});
