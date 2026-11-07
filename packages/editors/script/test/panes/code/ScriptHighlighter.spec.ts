// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ScriptHighlighter } from "#src/panes/code/ScriptHighlighter.ts";

function colors(
  highlighter: ScriptHighlighter,
  line: number
): string[][] {
  return (highlighter.tokens(line) ?? [])
    .map((token) => [token.content, token.color ?? ""]);
}

describe("ScriptHighlighter", () => {
  test("colors TypeScript and carries a block comment to the next line", async() => {
    const highlighter = await ScriptHighlighter.create("typescript");
    highlighter.update([
      "const value = 1; /* open",
      "still comment */ value;"
    ]);

    assert.deepEqual(colors(highlighter, 0).at(0), [
      "const",
      "var(--shiki-token-keyword)"
    ]);
    assert.deepEqual(colors(highlighter, 0).at(-1), [
      "/* open",
      "var(--shiki-token-comment)"
    ]);
    assert.deepEqual(colors(highlighter, 1), [
      ["still comment */", "var(--shiki-token-comment)"],
      [" value;", "var(--shiki-foreground)"]
    ]);
  });
});
