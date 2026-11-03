// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  insertIndent,
  insertNewline,
  removeIndent
} from "#src/code/EditingKeys.ts";

describe("EditingKeys", () => {
  test("Enter keeps the indentation and indents after an opening brace", () => {
    const text = "  if (ready) {";
    const { edit, selection } = insertNewline(text, { start: text.length, end: text.length });

    assert.equal(edit.applyTo(text), "  if (ready) {\n    ");
    assert.deepEqual(selection, { start: 19, end: 19 });
  });

  test("Tab replaces a selection within one line with an indent", () => {
    const { edit, selection } = insertIndent("abcd", { start: 1, end: 3 });

    assert.equal(edit.applyTo("abcd"), "a  d");
    assert.deepEqual(selection, { start: 3, end: 3 });
  });

  test("Tab and Shift+Tab shift every selected line", () => {
    const text = "a\n  b\nc";
    const selection = { start: 0, end: text.length };
    const indented = insertIndent(text, selection);
    const indentedText = indented.edit.applyTo(text);
    const outdented = removeIndent(indentedText, indented.selection);

    assert.equal(indentedText, "  a\n    b\n  c");
    assert.equal(outdented.edit.applyTo(indentedText), text);
  });
});
