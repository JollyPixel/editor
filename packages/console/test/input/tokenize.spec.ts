// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  quote,
  tokenize
} from "#src/input/tokenize.ts";

describe("tokenize", () => {
  const cases: [string, string[], boolean][] = [
    ["", [], false],
    ["   ", [], false],
    ["brush.size", ["brush.size"], false],
    ["  brush.size   3 ", ["brush.size", "3"], false],
    ["/say hello world", ["/say", "hello", "world"], false],
    ["keybind.redo \"mod+y, mod+shift+z\"", ["keybind.redo", "mod+y, mod+shift+z"], false],
    ["a \"say \\\"hi\\\"\"", ["a", "say \"hi\""], false],
    ["a \"back\\\\slash\"", ["a", "back\\slash"], false],
    ["a \"keep\\n\"", ["a", "keep\\n"], false],
    ["a \"\"", ["a", ""], false],
    ["a\tb", ["a", "b"], false],
    ["a \"open quote", ["a", "open quote"], true],
    ["a \"", ["a", ""], true]
  ];

  for (const [line, values, unterminated] of cases) {
    test(JSON.stringify(line), () => {
      const result = tokenize(line);

      assert.deepEqual(result.tokens.map((token) => token.value), values);
      assert.equal(result.unterminated, unterminated);
    });
  }

  test("reports the source range of each token, quotes included", () => {
    const line = "/set \"a b\" c";
    const { tokens } = tokenize(line);

    assert.deepEqual(
      tokens.map((token) => line.slice(token.start, token.end)),
      ["/set", "\"a b\"", "c"]
    );
    assert.deepEqual(tokens.map((token) => token.quoted), [false, true, false]);
  });
});

describe("quote", () => {
  test("leaves a bare token alone and round-trips anything else", () => {
    for (const value of ["mod+z", "a b", "say \"hi\"", "back\\slash", ""]) {
      const quoted = quote(value);

      assert.deepEqual(tokenize(quoted).tokens.map((token) => token.value), [value]);
    }
    assert.equal(quote("mod+z"), "mod+z");
  });
});
