// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { DropCandidate } from "../../../src/interaction/drag/dropIndex.ts";
import { slideOffsets } from "../../../src/interaction/drag/slideOffsets.ts";

// CONSTANTS
const kStrip: DropCandidate[] = [
  { start: 0, size: 40 },
  { start: 42, size: 60 },
  { start: 104, size: 40 },
  { start: 146, size: 80 }
];
const kSkewed: DropCandidate[] = [
  { start: 0, size: 50 },
  { start: 44, size: 50 },
  { start: 88, size: 50 }
];

describe("Interaction.slideOffsets", () => {
  test("moves nothing while the dragged child previews its own slot", () => {
    assert.deepEqual(slideOffsets(kStrip, 1, 1), [0, 0, 0, 0]);
    assert.deepEqual(slideOffsets(kStrip, 1, 2), [0, 0, 0, 0]);
  });

  test("slides the children it passes back by its own size and gap", () => {
    assert.deepEqual(slideOffsets(kStrip, 1, 4), [0, 0, -62, -62]);
    assert.deepEqual(slideOffsets(kStrip, 0, 3), [0, -42, -42, 0]);
  });

  test("slides the children it passes forward by its own size and gap", () => {
    assert.deepEqual(slideOffsets(kStrip, 3, 0), [82, 82, 82, 0]);
    assert.deepEqual(slideOffsets(kStrip, 2, 1), [0, 42, 0, 0]);
  });

  test("keeps overlapping children overlapped by the same amount", () => {
    assert.deepEqual(slideOffsets(kSkewed, 0, 3), [0, -44, -44]);
  });

  test("clamps an insertion past either end of the strip", () => {
    assert.deepEqual(slideOffsets(kStrip, 1, 9), slideOffsets(kStrip, 1, 4));
    assert.deepEqual(slideOffsets(kStrip, 2, -3), slideOffsets(kStrip, 2, 0));
  });
});
