// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  dismissDialog,
  type DismissibleDialog
} from "../../../src/containers/dialog/dialogDismiss.ts";

function recorder(
  dismissible: boolean
): { dialog: DismissibleDialog; calls: string[]; } {
  const calls: string[] = [];

  return {
    calls,
    dialog: {
      dismissible,
      settleConfirmation: (confirmed) => calls.push(`settle:${confirmed}`),
      cancel: () => calls.push("cancel"),
      close: () => calls.push("close")
    }
  };
}

describe("dismissDialog", () => {
  test("settles a pending confirmation as false, cancels, then closes", () => {
    const { dialog, calls } = recorder(true);

    assert.equal(dismissDialog(dialog), true);
    assert.deepEqual(calls, ["settle:false", "cancel", "close"]);
  });

  test("a non-dismissible dialog refuses and stays untouched", () => {
    const { dialog, calls } = recorder(false);

    assert.equal(dismissDialog(dialog), false);
    assert.deepEqual(calls, []);
  });
});
