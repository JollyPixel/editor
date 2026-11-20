// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { lintScript } from "#src/lint/linter/node.ts";

describe("lintScript", () => {
  test("reports oxlint rules at UTF-16 offsets after non-ASCII text", async() => {
    const text = "const label = \"é€😀\";\nexport const used = label;\ndebugger;\n";

    const diagnostics = await lintScript(text);

    assert.deepEqual(diagnostics, [
      {
        start: text.indexOf("debugger"),
        length: "debugger;".length,
        severity: "warning",
        message: "`debugger` statement is not allowed",
        code: "eslint(no-debugger)"
      }
    ]);
  });

  test("reports a syntax error as an error", async() => {
    const diagnostics = await lintScript("call(\n");

    assert.equal(diagnostics?.length, 1);
    assert.equal(diagnostics[0].severity, "error");
    assert.equal(diagnostics[0].start, "call(\n".length);
  });
});
