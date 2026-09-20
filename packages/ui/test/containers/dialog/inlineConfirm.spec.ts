// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveInlineConfirmation
} from "../../../src/containers/dialog/inlineConfirm.ts";

describe("resolveInlineConfirmation", () => {
  test("a bare confirmation gets the default labels and an accent action", () => {
    assert.deepEqual(
      resolveInlineConfirmation({ message: "Continue?" }),
      {
        message: "Continue?",
        confirmLabel: "OK",
        cancelLabel: "Cancel",
        danger: false,
        variant: "accent"
      }
    );
  });

  test("a dangerous confirmation gets a danger action", () => {
    assert.deepEqual(
      resolveInlineConfirmation({
        message: "Remove 3 blocks?",
        confirmLabel: "Remove",
        cancelLabel: "Keep",
        danger: true
      }),
      {
        message: "Remove 3 blocks?",
        confirmLabel: "Remove",
        cancelLabel: "Keep",
        danger: true,
        variant: "danger"
      }
    );
  });
});
