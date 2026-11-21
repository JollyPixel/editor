// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TextEdit,
  type ScriptChange
} from "@jolly-pixel/asset.script/client";
import type { ScriptDiagnostic } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import { CodeDiagnostics } from "#src/language/CodeDiagnostics.ts";
import { TextLines } from "#src/text/TextLines.ts";

function diagnostic(
  start: number,
  length: number,
  severity: ScriptDiagnostic["severity"] = "error"
): ScriptDiagnostic {
  return {
    start,
    length,
    severity,
    message: `at ${start}`,
    code: null
  };
}

function change(
  edit: TextEdit,
  origin: ScriptChange["origin"] = "input"
): ScriptChange {
  return {
    edit,
    origin,
    author: null
  };
}

function spans(
  diagnostics: CodeDiagnostics
): number[][] {
  return diagnostics.all.map(({ start, length }) => [start, length]);
}

describe("CodeDiagnostics", () => {
  test("merges both sources by offset and replaces one source without the other", () => {
    const diagnostics = new CodeDiagnostics();

    diagnostics.replace("types", [diagnostic(10, 2)]);
    diagnostics.replace("lint", [diagnostic(4, 1, "warning")]);
    diagnostics.replace("types", [diagnostic(20, 3)]);

    assert.deepEqual(diagnostics.all.map(({ start }) => start), [4, 20]);
  });

  test("follows an edit: text typed before a span moves it, text typed at its end stays out", () => {
    const diagnostics = new CodeDiagnostics();
    diagnostics.replace("types", [diagnostic(4, 3)]);

    diagnostics.follow(change(new TextEdit([
      { at: 7, insert: "!" },
      { at: 0, insert: "ab" }
    ])));

    assert.deepEqual(spans(diagnostics), [[6, 3]]);
  });

  test("collapses a span whose text an edit deleted", () => {
    const diagnostics = new CodeDiagnostics();
    diagnostics.replace("lint", [diagnostic(4, 3)]);

    diagnostics.follow(change(TextEdit.deletion(2, "xxxxxx")));

    assert.deepEqual(spans(diagnostics), [[2, 0]]);
  });

  test("drops every diagnostic when the document loads a new text", () => {
    const diagnostics = new CodeDiagnostics();
    diagnostics.replace("lint", [diagnostic(4, 3)]);
    diagnostics.replace("types", [diagnostic(0, 1)]);

    diagnostics.follow(change(TextEdit.insertion(0, "// loaded\n"), "load"));

    assert.deepEqual(spans(diagnostics), []);
  });

  test("finds the diagnostics under an offset, empty spans included", () => {
    const diagnostics = new CodeDiagnostics();
    diagnostics.replace("lint", [
      diagnostic(2, 4, "warning"),
      diagnostic(10, 1, "warning")
    ]);
    diagnostics.replace("types", [diagnostic(9, 0)]);

    assert.deepEqual(diagnostics.at(4).map(({ start }) => start), [2]);
    assert.deepEqual(diagnostics.at(9).map(({ start }) => start), [9]);
    assert.deepEqual(diagnostics.at(7), []);
  });

  test("colors a line by its worst diagnostic, an error outranking a warning", () => {
    const diagnostics = new CodeDiagnostics();
    const lines = new TextLines("ab cdef\nghi j\nklm");
    diagnostics.replace("lint", [
      diagnostic(2, 4, "warning"),
      diagnostic(10, 1, "warning")
    ]);
    diagnostics.replace("types", [diagnostic(9, 0)]);

    assert.equal(diagnostics.lineSeverity(lines, 0), "warning");
    assert.equal(diagnostics.lineSeverity(lines, 1), "error");
    assert.equal(diagnostics.lineSeverity(lines, 2), null);
  });

  test("emits a change for each replace and each followed edit", () => {
    let changes = 0;
    const diagnostics = new CodeDiagnostics();
    diagnostics.on("change", () => changes++);

    diagnostics.replace("lint", [diagnostic(4, 3)]);
    diagnostics.follow(change(TextEdit.insertion(0, "a")));

    assert.equal(changes, 2);
  });
});
