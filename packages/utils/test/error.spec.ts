// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  asError,
  errorMessage
} from "#src/index.ts";

describe("asError", () => {
  test("returns an Error as is and wraps anything else", () => {
    const error = new TypeError("boom");

    assert.equal(asError(error), error);
    assert.equal(asError("boom").message, "boom");
    assert.ok(asError(42) instanceof Error);
  });
});

describe("errorMessage", () => {
  test("reads the message of an Error and stringifies anything else", () => {
    assert.equal(errorMessage(new Error("boom")), "boom");
    assert.equal(errorMessage("boom"), "boom");
    assert.equal(errorMessage(undefined), "undefined");
  });
});
