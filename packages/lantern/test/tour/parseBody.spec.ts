// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseBody } from "#src/tour/parseBody.ts";

describe("parseBody", () => {
  test("starts a paragraph at each blank line, not at a single line break", () => {
    assert.deepEqual(parseBody("Pick a block.\nAny block.\n\n\nThen place it.\n"), [
      [{ kind: "text", text: "Pick a block.\nAny block." }],
      [{ kind: "text", text: "Then place it." }]
    ]);
  });

  test("renders backtick spans as keys", () => {
    assert.deepEqual(parseBody("Press `Ctrl+K` or `F1`."), [
      [
        { kind: "text", text: "Press " },
        { kind: "kbd", text: "Ctrl+K" },
        { kind: "text", text: " or " },
        { kind: "kbd", text: "F1" },
        { kind: "text", text: "." }
      ]
    ]);
  });

  test("keeps an unmatched backtick as text", () => {
    assert.deepEqual(parseBody("a ` b"), [
      [{ kind: "text", text: "a ` b" }]
    ]);
  });
});
