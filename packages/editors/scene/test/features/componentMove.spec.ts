// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { componentMove } from "../../src/features/inspector/componentMove.ts";

// CONSTANTS
const kIds = ["a", "b", "c", "d"];

describe("componentMove", () => {
  test("places the component before the one at the insertion slot", () => {
    assert.deepEqual(componentMove(kIds, 0, 3), { id: "a", beforeId: "d" });
    assert.deepEqual(componentMove(kIds, 3, 1), { id: "d", beforeId: "b" });
    assert.deepEqual(componentMove(kIds, 2, 0), { id: "c", beforeId: "a" });
  });

  test("appends the component when the slot is past the last one", () => {
    assert.deepEqual(componentMove(kIds, 1, 4), { id: "b" });
    assert.deepEqual(componentMove(kIds, 1, 9), { id: "b" });
  });

  test("moves nothing when the slot is on either side of the component", () => {
    assert.strictEqual(componentMove(kIds, 1, 1), null);
    assert.strictEqual(componentMove(kIds, 1, 2), null);
    assert.strictEqual(componentMove(kIds, 3, 9), null);
  });
});
