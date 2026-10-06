// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { highlightLine } from "#src/script/highlightLine.ts";
import { scanLine } from "#src/script/scanScript.ts";

function pieces(
  text: string,
  valueType?: "string" | "number" | "boolean" | "enum",
  errors: Array<{ start: number; end: number; }> = []
): string[] {
  return highlightLine(scanLine(text), valueType, errors).map(
    (piece) => `${piece.kind ?? "-"}${piece.error ? "!" : ""}:${piece.text}`
  );
}

describe("highlightLine", () => {
  test("splits an entry into key, operator and a value colored by its variable type", () => {
    assert.deepEqual(pieces("  size =  4 ", "number"), [
      "-:  ",
      "key:size",
      "-: ",
      "operator:=",
      "-:  ",
      "value-number:4",
      "-: "
    ]);
    assert.deepEqual(pieces("nope = 4"), [
      "key:nope",
      "-: ",
      "operator:=",
      "-: ",
      "value:4"
    ]);
  });

  test("covers comments and sections whole, and blank or invalid lines as plain text", () => {
    assert.deepEqual(pieces("; size <number>"), ["comment:; size <number>"]);
    assert.deepEqual(pieces(" [brush] "), ["-: ", "section:[brush]", "-: "]);
    assert.deepEqual(pieces("   "), ["-:   "]);
    assert.deepEqual(pieces("just words"), ["-:just words"]);
  });

  test("marks the characters an error covers, splitting the tokens it crosses", () => {
    assert.deepEqual(pieces("size = big", "number", [{ start: 5, end: 9 }]), [
      "key:size",
      "-: ",
      "operator!:=",
      "-!: ",
      "value-number!:bi",
      "value-number:g"
    ]);
    assert.deepEqual(pieces("just words", undefined, [{ start: 0, end: 10 }]), [
      "-!:just words"
    ]);
  });
});
