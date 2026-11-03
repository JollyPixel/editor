// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ScriptDocument } from "#src/model/ScriptDocument.ts";
import { TextEdit } from "#src/text/TextEdit.ts";

describe("ScriptDocument history", () => {
  test("keystrokes typed in a burst undo together, a pause starts a new step", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const document = new ScriptDocument();

    document.edit(TextEdit.insertion(0, "a"));
    t.mock.timers.tick(100);
    document.edit(TextEdit.insertion(1, "b"));
    t.mock.timers.tick(2_000);
    document.edit(TextEdit.insertion(2, "c"));

    document.undo();
    assert.equal(document.text, "ab");
    document.undo();
    assert.equal(document.text, "");
    document.redo();
    assert.equal(document.text, "ab");
  });

  test("an undo step keeps working after a remote edit before it", () => {
    const document = new ScriptDocument();
    document.load("const a = 1;");

    document.edit(TextEdit.insertion(12, " // mine"));
    document.applyRemote(TextEdit.insertion(0, "export "));
    document.undo();

    assert.equal(document.text, "export const a = 1;");
  });

  test("a new edit clears the redo steps", () => {
    const document = new ScriptDocument();

    document.edit(TextEdit.insertion(0, "a"));
    document.undo();
    document.edit(TextEdit.insertion(0, "b"));

    assert.equal(document.redo(), false);
    assert.equal(document.text, "b");
  });
});
