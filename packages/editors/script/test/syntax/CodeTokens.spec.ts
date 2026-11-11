// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CodeTokens } from "#src/syntax/CodeTokens.ts";
import { TextLines } from "#src/text/TextLines.ts";

// CONSTANTS
const kStatement = "const speed = 1;";

function source(
  lines: number
): string[] {
  return Array.from({ length: lines }, () => kStatement);
}

function commentedAt(
  lines: string[],
  index: number
): TextLines {
  const edited = [...lines];
  edited[index] = `/* ${edited[index]}`;

  return new TextLines(edited.join("\n"));
}

function isComment(
  tokens: CodeTokens,
  line: number
): boolean {
  return (tokens.line(line)?.tokens ?? [])
    .filter((token) => token.value.trim() !== "")
    .every((token) => token.type === "comment");
}

describe("CodeTokens", () => {
  test("highlights a small file in full on every read", () => {
    const lines = source(20);
    const tokens = new CodeTokens(() => assert.fail("a small file needs no refresh"));

    tokens.reset(new TextLines(lines.join("\n")), "typescript");
    tokens.read(commentedAt(lines, 5));

    assert.equal(isComment(tokens, 6), true);
  });

  test("re-highlights the edited lines of a large file at once and the whole file after a pause", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const lines = source(2_000);
    let refreshes = 0;
    const tokens = new CodeTokens(() => refreshes++);

    tokens.reset(new TextLines(lines.join("\n")), "typescript");
    tokens.read(commentedAt(lines, 5));

    assert.equal(isComment(tokens, 5), true);
    assert.equal(refreshes, 0);

    t.mock.timers.tick(1_000);

    assert.equal(isComment(tokens, 6), true);
    assert.equal(refreshes, 1);
  });
});
