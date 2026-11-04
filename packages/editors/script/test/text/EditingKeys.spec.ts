// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  insertIndent,
  insertNewline,
  removeIndent
} from "#src/text/EditingKeys.ts";
import { ScriptCaret } from "#src/text/ScriptCaret.ts";
import { TextLines } from "#src/text/TextLines.ts";

describe("EditingKeys", () => {
  test("Enter keeps the indentation and indents after an opening brace", () => {
    const text = "  if (ready) {";
    const { edit, caret } = insertNewline(new TextLines(text), ScriptCaret.collapsed(text.length));

    assert.equal(edit.applyTo(text), "  if (ready) {\n    ");
    assert.deepEqual(caret, ScriptCaret.collapsed(19));
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
