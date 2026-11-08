// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { fileExtension } from "#src/index.ts";

describe("fileExtension", () => {
  for (const [path, expected] of [
    ["hero.png", ".png"],
    ["Hero.PNG", ".png"],
    ["sprites/hero.sheet.png", ".png"],
    ["v1.2/readme", ""],
    ["noextension", ""],
    [".gitignore", ""]
  ] as const) {
    test(`${path} -> "${expected}"`, () => {
      assert.equal(fileExtension(path), expected);
    });
  }
});
