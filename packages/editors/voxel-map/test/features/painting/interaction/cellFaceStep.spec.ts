// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { cellFaceStep } from "../../../../src/features/painting/interaction/cellFaceStep.ts";

// CONSTANTS
const kCell = { x: 0, y: 0, z: 0 };

describe("cellFaceStep", () => {
  test("steps toward the face the ray enters", () => {
    const cases = [
      {
        origin: { x: 0.5, y: 5, z: 0.5 },
        direction: { x: 0, y: -1, z: 0 },
        step: { x: 0, y: 1, z: 0 }
      },
      {
        origin: { x: 0.5, y: -5, z: 0.5 },
        direction: { x: 0, y: 1, z: 0 },
        step: { x: 0, y: -1, z: 0 }
      },
      {
        origin: { x: 0.5, y: 0.5, z: -5 },
        direction: { x: 0, y: 0, z: 1 },
        step: { x: 0, y: 0, z: -1 }
      },
      {
        origin: { x: 5, y: 0.5, z: 0.5 },
        direction: { x: -1, y: 0, z: 0 },
        step: { x: 1, y: 0, z: 0 }
      }
    ];

    for (const { origin, direction, step } of cases) {
      assert.deepStrictEqual(
        cellFaceStep({ origin, direction }, kCell),
        step
      );
    }
  });

  test("enters the side face on a shallow downward aim", () => {
    const step = cellFaceStep({
      origin: { x: 0.5, y: 2, z: -4 },
      direction: { x: 0, y: -0.3, z: 0.95 }
    }, kCell);

    assert.deepStrictEqual(step, { x: 0, y: 0, z: -1 });
  });

  test("enters the top face on a steep downward aim", () => {
    const step = cellFaceStep({
      origin: { x: 0.5, y: 4, z: -1 },
      direction: { x: 0, y: -0.9, z: 0.44 }
    }, kCell);

    assert.deepStrictEqual(step, { x: 0, y: 1, z: 0 });
  });

  test("reads the cell offset", () => {
    const step = cellFaceStep({
      origin: { x: 2.5, y: 3.5, z: -5 },
      direction: { x: 0, y: 0, z: 1 }
    }, { x: 2, y: 3, z: 4 });

    assert.deepStrictEqual(step, { x: 0, y: 0, z: -1 });
  });

  test("reports nothing when the ray misses the cell", () => {
    const step = cellFaceStep({
      origin: { x: 5.5, y: 0.5, z: -5 },
      direction: { x: 0, y: 0, z: 1 }
    }, kCell);

    assert.strictEqual(step, null);
  });

  test("reports nothing when the ray starts inside the cell", () => {
    const step = cellFaceStep({
      origin: { x: 0.5, y: 0.5, z: 0.5 },
      direction: { x: 0, y: 0, z: 1 }
    }, kCell);

    assert.strictEqual(step, null);
  });

  test("reports nothing when the cell sits behind the ray", () => {
    const step = cellFaceStep({
      origin: { x: 0.5, y: 0.5, z: 5 },
      direction: { x: 0, y: 0, z: 1 }
    }, kCell);

    assert.strictEqual(step, null);
  });
});
