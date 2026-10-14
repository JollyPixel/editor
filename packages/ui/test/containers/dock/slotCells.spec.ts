// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { slotCells } from "../../../src/containers/dock/slotCells.ts";

const kBounds = {
  x: 0,
  y: 0,
  width: 800,
  height: 600
};
const kCandidates = [
  {
    start: 100,
    size: 100
  },
  {
    start: 220,
    size: 80
  }
];

describe("Containers.slotCells", () => {
  test("splits the bounds at the middle of each gap, outer cells reaching the edges", () => {
    assert.deepEqual(slotCells(kBounds, kCandidates, "y"), [
      {
        x: 0,
        y: 0,
        width: 800,
        height: 210
      },
      {
        x: 0,
        y: 210,
        width: 800,
        height: 390
      }
    ]);
  });

  test("splits along x for a horizontal dock", () => {
    assert.deepEqual(slotCells(kBounds, kCandidates, "x"), [
      {
        x: 0,
        y: 0,
        width: 210,
        height: 600
      },
      {
        x: 210,
        y: 0,
        width: 590,
        height: 600
      }
    ]);
  });
});
