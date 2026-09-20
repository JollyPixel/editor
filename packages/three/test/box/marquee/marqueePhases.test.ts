// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { marqueePhases } from "#src/box/marquee/marqueePhases.ts";

// CONSTANTS
const kEdgeCount = 12;
const kRingEdges = 4;

function edgePhases(
  phases: number[],
  edge: number
): [number, number] {
  return [phases[edge * 2], phases[(edge * 2) + 1]];
}

describe("marqueePhases", () => {
  test("yields a start and an end phase per box edge", () => {
    const phases = marqueePhases({ x: 4, y: 3, z: 2 }, 0.5);

    assert.equal(phases.length, kEdgeCount * 2);
  });

  test("chains the edges of a ring end to start", () => {
    const phases = marqueePhases({ x: 4, y: 3, z: 2 }, 0.5);

    for (let edge = 1; edge < kRingEdges; edge++) {
      assert.equal(
        edgePhases(phases, edge)[0],
        edgePhases(phases, edge - 1)[1]
      );
    }
  });

  test("gives both rings the same phases", () => {
    const phases = marqueePhases({ x: 4, y: 3, z: 2 }, 0.5);

    assert.deepEqual(
      phases.slice(0, kRingEdges * 2),
      phases.slice(kRingEdges * 2, kRingEdges * 4)
    );
  });

  const cases = [
    {
      name: "an exact fit",
      size: { x: 4, y: 3, z: 2 },
      dashLength: 0.5,
      ringPeriods: 24,
      verticalPeriods: 6
    },
    {
      name: "a dash length that does not divide the box",
      size: { x: 3, y: 1, z: 2 },
      dashLength: 0.7,
      ringPeriods: 14,
      verticalPeriods: 1
    },
    {
      name: "a dash length longer than the box",
      size: { x: 0.1, y: 0.1, z: 0.1 },
      dashLength: 4,
      ringPeriods: 1,
      verticalPeriods: 1
    }
  ];

  for (const { name, size, dashLength, ringPeriods, verticalPeriods } of cases) {
    test(`closes each loop on a whole period for ${name}`, () => {
      const phases = marqueePhases(size, dashLength);

      assert.equal(edgePhases(phases, 0)[0], 0);
      assert.ok(
        Math.abs(edgePhases(phases, kRingEdges - 1)[1] - ringPeriods) < 1e-9
      );
      for (let edge = kRingEdges * 2; edge < kEdgeCount; edge++) {
        assert.deepEqual(
          edgePhases(phases, edge),
          [0, verticalPeriods]
        );
      }
    });
  }
});
