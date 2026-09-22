// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Internal Dependencies
import {
  DEFAULT_PROJECT_DIR,
  PROJECT_ROOT_ENV,
  resolveProjectRoot
} from "../vite/projectRoot.ts";

// CONSTANTS
const kBase = path.resolve("/studio");

describe("resolveProjectRoot", () => {
  test("defaults to the project folder beside the package", () => {
    assert.strictEqual(
      resolveProjectRoot(kBase, {}),
      path.join(kBase, DEFAULT_PROJECT_DIR)
    );
  });

  test("ignores a blank variable", () => {
    assert.strictEqual(
      resolveProjectRoot(kBase, { [PROJECT_ROOT_ENV]: "  " }),
      path.join(kBase, DEFAULT_PROJECT_DIR)
    );
  });

  test("resolves a relative variable against the package", () => {
    assert.strictEqual(
      resolveProjectRoot(kBase, { [PROJECT_ROOT_ENV]: "../game" }),
      path.resolve(kBase, "../game")
    );
  });

  test("keeps an absolute variable", () => {
    const absolute = path.resolve("/games/demo");

    assert.strictEqual(
      resolveProjectRoot(kBase, { [PROJECT_ROOT_ENV]: absolute }),
      absolute
    );
  });
});
