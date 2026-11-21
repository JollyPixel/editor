// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { TextFormat } from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import { TextLines } from "#src/text/TextLines.ts";

describe("TextLines", () => {
  test("offsetAt finds the character drawn at a visual column, a tab covering its whole stop", () => {
    const lines = new TextLines("let a;\n\tx = 1;");
    const secondLine = "let a;\n".length;

    assert.equal(lines.offsetAt(0, 4), 4);
    assert.equal(lines.offsetAt(1, 0), secondLine);
    assert.equal(lines.offsetAt(1, 1), secondLine);
    assert.equal(lines.offsetAt(1, 2), secondLine + 1);
  });

  test("a tab reaches the next stop of the document's tab width", () => {
    const lines = new TextLines("\tx\nab\tx", new TextFormat({ tabWidth: 4 }));

    assert.equal(lines.visualColumn({ line: 0, column: 1 }), 4);
    assert.equal(lines.visualColumn({ line: 1, column: 3 }), 4);
  });

  test("offsetAt is null past the end of a line or below the last line", () => {
    const lines = new TextLines("let a;\n\tx = 1;");

    assert.equal(lines.offsetAt(0, 6), null);
    assert.equal(lines.offsetAt(2, 0), null);
  });
});
