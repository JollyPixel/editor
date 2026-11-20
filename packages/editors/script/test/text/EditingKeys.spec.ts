// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  deleteBackward,
  insertIndent,
  insertNewline,
  removeIndent,
  typeCharacter,
  type KeyCommand
} from "#src/text/EditingKeys.ts";
import { ScriptCaret } from "#src/text/ScriptCaret.ts";
import { TextLines } from "#src/text/TextLines.ts";

describe("EditingKeys", () => {
  const typing = [
    ["call|", "(", "call(|)"],
    ["  |", "{", "  {|}"],
    ["f(|)", "[", "f([|])"],
    ["const name = |;", "\"", "const name = \"|\";"],
    ["f(|)", ")", "f()|"],
    ["\"text|\"", "\"", "\"text\"|"],
    ["|value", "(", null],
    ["don|", "'", null],
    ["\"\\|", "\"", null],
    ["a|", "b", null]
  ] as const;
  for (const [before, character, after] of typing) {
    test(`typing ${character} in ${before} ${outcome(after)}`, () => {
      assert.equal(
        press(before, (lines, caret) => typeCharacter(lines, caret, character)),
        after
      );
    });
  }

  test("typing an opener over a selection keeps the native replacement", () => {
    assert.equal(typeCharacter(new TextLines("abc"), new ScriptCaret(0, 3), "("), null);
  });

  const erasing = [
    ["call(|)", "call|"],
    ["\"|\"", "|"],
    ["call(|x)", null],
    ["(x|)", null]
  ] as const;
  for (const [before, after] of erasing) {
    test(`Backspace in ${before} ${outcome(after)}`, () => {
      assert.equal(press(before, deleteBackward), after);
    });
  }

  test("Enter between brackets puts the closer on its own line", () => {
    assert.equal(press("  if (ready) {|}", insertNewline), "  if (ready) {\n    |\n  }");
    assert.equal(press("call(|)", insertNewline), "call(\n  |\n)");
  });

  test("Enter keeps the indentation and indents after an opening brace", () => {
    assert.equal(press("  if (ready) {|", insertNewline), "  if (ready) {\n    |");
  });

  test("Tab replaces a selection within one line with an indent", () => {
    const { edit, caret } = insertIndent(new TextLines("abcd"), new ScriptCaret(1, 3));

    assert.equal(edit.applyTo("abcd"), "a  d");
    assert.deepEqual(caret, ScriptCaret.collapsed(3));
  });

  test("Tab and Shift+Tab shift every selected line", () => {
    const text = "a\n  b\nc";
    const indented = insertIndent(new TextLines(text), new ScriptCaret(0, text.length));
    const indentedText = indented.edit.applyTo(text);
    const outdented = removeIndent(new TextLines(indentedText), indented.caret);

    assert.equal(indentedText, "  a\n    b\n  c");
    assert.equal(outdented.edit.applyTo(indentedText), text);
  });

  test("Tab keeps a backward selection backward", () => {
    const text = "a\nb";
    const { caret } = insertIndent(new TextLines(text), new ScriptCaret(text.length, 0));

    assert.deepEqual(caret, new ScriptCaret(7, 0));
  });
});

function outcome(
  after: string | null
): string {
  return after === null ? "stays native" : `gives ${after}`;
}

function press(
  marked: string,
  command: KeyCommand
): string | null {
  const at = marked.indexOf("|");
  const text = marked.replace(/\|/g, "");
  const keyEdit = command(new TextLines(text), ScriptCaret.collapsed(at));
  if (keyEdit === null) {
    return null;
  }

  const result = keyEdit.edit.applyTo(text);

  return `${result.slice(0, keyEdit.caret.head)}|${result.slice(keyEdit.caret.head)}`;
}
