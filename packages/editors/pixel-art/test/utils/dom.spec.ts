// Import Node.js Dependencies
import assert from "node:assert";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { assertElement, isInputElement } from "../../src/utils/dom.ts";

describe("assertElement", () => {
  it("should return the element when it is not null", () => {
    const div = document.createElement("div");

    assert.strictEqual(assertElement(div, "missing"), div);
  });

  it("should throw with the given message when the element is null", () => {
    assert.throws(
      () => assertElement(null, "element not found"),
      /element not found/
    );
  });

  it("should throw when the element is undefined", () => {
    assert.throws(() => assertElement(undefined, "element not found"));
  });
});

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
