// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PeerPlayhead } from "#src/collaboration/Playheads.ts";
import {
  PLAYHEAD_TAG_WIDTH,
  TagStack
} from "#src/panes/track/TagStack.ts";

// CONSTANTS
const kWidth = PLAYHEAD_TAG_WIDTH * 10;

function playhead(
  position: number,
  ...names: string[]
): PeerPlayhead {
  return {
    clientId: names[0],
    color: "red",
    position,
    tags: names.map((name) => {
      return {
        key: name,
        name,
        color: "red"
      };
    })
  };
}

describe("TagStack", () => {
  test("keeps tags of distant playheads on the bottom row", () => {
    const stacks = new TagStack(kWidth).arrange([
      playhead(0.1, "alice", "bob"),
      playhead(0.5, "carol")
    ]);

    assert.deepEqual(stacks.map(({ row }) => row), [0, 0]);
  });

  for (const [first, second] of [[0.5, 0.5001], [0.5001, 0.5]]) {
    test(`lifts a later playhead's tags above the stack it would cover (${first} then ${second})`, () => {
      const stacks = new TagStack(kWidth).arrange([
        playhead(first, "alice", "bob"),
        playhead(second, "carol")
      ]);

      assert.deepEqual(stacks.map(({ row }) => row), [0, 2]);
    });
  }

  test("turns tags toward the left near the end of the wave", () => {
    const stacks = new TagStack(kWidth).arrange([
      playhead(0.95, "alice")
    ]);

    assert.equal(stacks[0].flipped, true);
  });

  test("folds names past the third into a count", () => {
    const [stack] = new TagStack(kWidth).arrange([
      playhead(0, "alice", "bob", "carol", "dave")
    ]);

    assert.deepEqual(stack.labels.map(({ name }) => name), [
      "alice",
      "bob",
      "+2"
    ]);
  });
});
