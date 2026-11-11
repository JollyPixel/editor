// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  fileLanguage,
  highlight
} from "#src/syntax/highlight.ts";

function kinds(
  text: string,
  line: number
): string[][] {
  return (highlight(text, "wgsl")[line]?.tokens ?? [])
    .filter((token) => token.value.trim() !== "")
    .map((token) => [token.value, token.type]);
}

describe("fileLanguage", () => {
  test("resolves the extensions the script, shader and text kinds accept", () => {
    const cases = [
      ["scripts/Player.ts", "typescript"],
      ["shaders/water.tsl.ts", "typescript"],
      ["docs/README.md", "markdown"],
      ["config.jsonc", "json"],
      ["feed.xml", "html"],
      ["ci.yml", "yaml"]
    ];

    for (const [path, language] of cases) {
      assert.equal(fileLanguage(path), language, path);
    }
  });

  test("falls back to plain text for .txt and unknown extensions", () => {
    assert.equal(fileLanguage("notes.txt"), "plaintext");
    assert.equal(fileLanguage("LICENSE"), "plaintext");
    assert.equal(fileLanguage("data.unknown"), "plaintext");
  });
});

describe("highlight", () => {
  test("colors WGSL keywords and types, keeping lines after a line comment aligned", () => {
    const wgsl = [
      "// generated",
      "",
      "@fragment fn main() -> @location(0) vec4f {",
      "  let tint: vec3<f32> = vec3<f32>(1.0);"
    ].join("\n");

    assert.deepEqual(kinds(wgsl, 0), [["// generated", "comment"]]);
    assert.deepEqual(kinds(wgsl, 1), []);
    assert.deepEqual(
      kinds(wgsl, 2).filter(([, type]) => type !== "sign" && type !== "identifier"),
      [
        ["fragment", "keyword"],
        ["fn", "keyword"],
        ["location", "keyword"],
        ["0", "class"],
        ["vec4f", "class"]
      ]
    );
    assert.deepEqual(kinds(wgsl, 3).slice(0, 4), [
      ["let", "keyword"],
      ["tint", "identifier"],
      [":", "sign"],
      ["vec3", "class"]
    ]);
  });
});
