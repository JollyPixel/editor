// Import Node.js Dependencies
import assert from "node:assert";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { isInputElement } from "../../src/shared/dom.ts";

describe("isInputElement", () => {
  it("should return true for an HTMLInputElement", () => {
    const input = document.createElement("input");

    assert.strictEqual(isInputElement(input), true);
  });

  it("should return false for a non-input element", () => {
    const div = document.createElement("div");

    assert.strictEqual(isInputElement(div), false);
  });

  it("should return false for null", () => {
    assert.strictEqual(isInputElement(null), false);
  });
});
