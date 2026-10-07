// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChangeReceipts } from "#src/index.ts";

describe("ChangeReceipts", () => {
  test("receipts take a single sync client", () => {
    const receipts = new ChangeReceipts<object>();
    receipts.attach();

    assert.throws(
      () => receipts.attach(),
      { message: "ChangeReceipts: a sync client already writes these receipts." }
    );
  });
});
