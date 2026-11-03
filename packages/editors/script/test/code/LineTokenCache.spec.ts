// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  LineTokenCache,
  type LineTokenizer
} from "#src/code/LineTokenCache.ts";

const kCommentTokenizer: LineTokenizer<string, boolean> = {
  tokenize: (line, state) => {
    let inComment = state ?? false;
    if (line.includes("/*")) {
      inComment = true;
    }
    const token = inComment ? `comment:${line}` : `code:${line}`;
    if (line.includes("*/")) {
      inComment = false;
    }

    return {
      tokens: [token],
      state: inComment
    };
  },
  sameState: (left, right) => left === right
};

describe("LineTokenCache", () => {
  test("an edit inside one line retokenizes only that line", () => {
    const cache = new LineTokenCache(kCommentTokenizer);
    cache.update(["a", "b", "c", "d"]);

    cache.update(["a", "B", "c", "d"]);

    assert.equal(cache.tokenizedLines, 2);
    assert.deepEqual(cache.tokens(1), ["code:B"]);
    assert.deepEqual(cache.tokens(3), ["code:d"]);
  });

  test("opening a block comment retokenizes the lines it now covers", () => {
    const cache = new LineTokenCache(kCommentTokenizer);
    cache.update(["a", "b", "c */", "d"]);

    cache.update(["/* a", "b", "c */", "d"]);

    assert.deepEqual(cache.tokens(1), ["comment:b"]);
    assert.deepEqual(cache.tokens(2), ["comment:c */"]);
    assert.deepEqual(cache.tokens(3), ["code:d"]);
  });

  test("inserted lines shift the reused tokens below them", () => {
    const cache = new LineTokenCache(kCommentTokenizer);
    cache.update(["a", "b"]);

    cache.update(["a", "x", "y", "b"]);

    assert.deepEqual(cache.tokens(3), ["code:b"]);
    assert.equal(cache.tokens(4), null);
  });
});
