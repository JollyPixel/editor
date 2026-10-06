// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { ScriptDraft } from "#src/index.ts";
import { withBrush } from "../helpers/script/withBrush.ts";

function changesOf(
  draft: ScriptDraft
): string[] {
  return draft.changes.map(
    (change) => `${change.line}: ${change.address} = ${JSON.stringify(change.value)}`
  );
}

function diagnosticsOf(
  draft: ScriptDraft
): string[] {
  return draft.diagnostics.map(
    (diagnostic) => `${diagnostic.line}:${diagnostic.start}-${diagnostic.end} ${diagnostic.message}`
  );
}

describe("VariableScript", () => {
  test("writes root variables, then each namespace with variables, with descriptions and types", () => {
    const { commands } = withBrush();

    assert.equal(commands.editScript().text, [
      "; Ambient theme <dark|light>",
      "theme = dark",
      "",
      "; Voxel brush",
      "[brush]",
      "; Brush size in voxels <number>",
      "size = 1",
      "; <build|replace>",
      "mode = build",
      "; Preview the block under the cursor <boolean>",
      "ghost = true",
      "; Name shown in the toolbar <string>",
      "label = main brush"
    ].join("\n"));
  });

  test("a namespace scope writes that namespace only", () => {
    const { commands } = withBrush();

    const script = commands.editScript("BRUSH");

    assert.equal(script.scope, "brush");
    assert.deepEqual(script.text.split("\n").slice(0, 3), [
      "; Voxel brush",
      "[brush]",
      "; Brush size in voxels <number>"
    ]);
  });

  test("quotes a value only when it would not read back as written", () => {
    const { commands, brush } = withBrush();

    for (const [label, written] of [
      ["", "\"\""],
      [" padded", "\" padded\""],
      ["\"quoted\" \\ name", "\"\\\"quoted\\\" \\\\ name\""],
      ["a = b ; c", "a = b ; c"]
    ]) {
      brush.label = label;
      const script = commands.editScript("brush");

      assert.ok(script.text.endsWith(`label = ${written}`), label);
      assert.deepEqual(changesOf(script.parse(script.text)), [], label);
    }
  });

  test("the unedited text parses with no change and no diagnostic", () => {
    const { commands } = withBrush();
    const script = commands.editScript();

    const draft = script.parse(script.text);

    assert.equal(draft.ok, true);
    assert.deepEqual(changesOf(draft), []);
    assert.equal(draft.valueType(2), "enum");
    assert.equal(draft.valueType(7), "number");
    assert.equal(draft.valueType(1), undefined);
  });

  test("lists edited keys only, with coerced values, matching keys and sections in any case", () => {
    const { commands } = withBrush();
    const script = commands.editScript();

    const draft = script.parse([
      "THEME = Light",
      "[Brush]",
      "size = 4",
      "Mode = build",
      "ghost = off",
      "label = \"  spaced \""
    ].join("\n"));

    assert.deepEqual(diagnosticsOf(draft), []);
    assert.deepEqual(changesOf(draft), [
      "1: theme = \"light\"",
      "3: brush.size = 4",
      "5: brush.ghost = false",
      "6: brush.label = \"  spaced \""
    ]);
  });

  test("an unedited key is not a change after its live value moved", () => {
    const { commands, brush } = withBrush();
    const script = commands.editScript("brush");
    brush.size = 9;

    const draft = script.parse(script.text.replace("mode = build", "mode = replace"));

    assert.deepEqual(changesOf(draft), ["6: brush.mode = \"replace\""]);
  });

  test("a key that was not written in the script compares against its live value", () => {
    const { commands } = withBrush();
    const script = commands.editScript("brush");

    const draft = script.parse("theme = dark\nbrush.size = 3");

    assert.deepEqual(changesOf(draft), ["2: brush.size = 3"]);
  });

  test("reports each malformed line with its range and keeps no change for it", () => {
    const { commands } = withBrush();
    const script = commands.editScript();

    const draft = script.parse([
      "[brsh]",
      "size = 2",
      "[brush",
      "size = big",
      "sise = 2",
      "size = 3",
      "mode = \"build",
      "mode = \"build\" x",
      "just words",
      " = 4",
      "ghost =",
      "[]"
    ].join("\n"));

    assert.deepEqual(changesOf(draft), []);
    assert.deepEqual(diagnosticsOf(draft), [
      "1:1-5 Unknown namespace \"brsh\". Did you mean brush?",
      "3:1-6 Expected \"]\" at the end of the section",
      "4:7-10 Expected a number, got \"big\"",
      "5:0-4 Unknown variable \"brush.sise\". Did you mean brush.size?",
      "6:0-4 brush.size is already set on line 4",
      "7:7-13 Unterminated quote",
      "8:0-4 brush.mode is already set on line 7",
      "9:0-10 Expected name = value",
      "10:1-2 Expected a name before =",
      "11:6-7 Expected a boolean (true, false, yes, no, on, off, 1, 0), got \"\"",
      "12:1-1 Expected a namespace name"
    ]);
    assert.equal(draft.ok, false);
  });

  test("an entry after a trailing closing quote is rejected", () => {
    const { commands } = withBrush();
    const script = commands.editScript("brush");

    const draft = script.parse("[brush]\nmode = \"build\" x");

    assert.deepEqual(diagnosticsOf(draft), [
      "2:7-16 Unexpected text after the closing quote"
    ]);
  });
});
