// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { BlockSelection } from "../../src/state/BlockSelection.ts";

describe("BlockSelection", () => {
  test("starts on the first block", () => {
    assert.strictEqual(new BlockSelection().id, 1);
  });

  test("emits once per actual change", () => {
    const block = new BlockSelection();
    const changes: number[] = [];
    block.subscribe("change", (id) => changes.push(id));

    block.id = 4;
    block.id = 4;
    block.id = 1;

    assert.deepStrictEqual(changes, [4, 1]);
    assert.strictEqual(block.id, 1);
  });
});
