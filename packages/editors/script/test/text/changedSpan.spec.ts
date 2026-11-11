// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { changedSpan } from "#src/text/changedSpan.ts";

describe("changedSpan", () => {
  test("spans only what differs between the shared prefix and suffix", () => {
    assert.deepEqual(changedSpan("let a = 1;", "let b = 1;"), {
      start: 4,
      beforeEnd: 5,
      afterEnd: 5
    });
    assert.deepEqual(changedSpan("same", "same"), {
      start: 4,
      beforeEnd: 4,
      afterEnd: 4
    });
  });

  test("never lets the suffix overlap the prefix when a repeated item is inserted or removed", () => {
    assert.deepEqual(changedSpan("aa", "aaa"), {
      start: 2,
      beforeEnd: 2,
      afterEnd: 3
    });
    assert.deepEqual(changedSpan("aaa", "aa"), {
      start: 2,
      beforeEnd: 3,
      afterEnd: 2
    });
  });

  test("compares items of different types through the given predicate", () => {
    const tokens = [{ raw: "# Title" }, { raw: "Body" }, { raw: "End" }];
    const blocks = ["# Title", "Edited", "End"];

    assert.deepEqual(changedSpan(tokens, blocks, (token, block) => token.raw === block), {
      start: 1,
      beforeEnd: 2,
      afterEnd: 2
    });
  });
});
