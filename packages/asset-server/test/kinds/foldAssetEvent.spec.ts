// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { foldAssetEvent } from "#src/index.ts";
import {
  COUNTER_INCREMENTED,
  counterHandler
} from "../helpers/kinds.ts";
import { assetEvent } from "../helpers/events.ts";

describe("foldAssetEvent", () => {
  test("applies a command the protocol accepts", () => {
    const handler = counterHandler();
    const state = handler.create("a1");

    foldAssetEvent(
      handler,
      state,
      assetEvent(COUNTER_INCREMENTED, { action: "increment" })
    );
    foldAssetEvent(
      handler,
      state,
      assetEvent(COUNTER_INCREMENTED, { action: "increment" })
    );

    assert.strictEqual(state.value, 2);
  });

  test("ignores a command payload the protocol rejects", () => {
    const handler = counterHandler();
    const state = handler.create("a1");

    foldAssetEvent(
      handler,
      state,
      assetEvent(COUNTER_INCREMENTED, { action: "decrement" })
    );
    foldAssetEvent(handler, state, assetEvent(COUNTER_INCREMENTED, null));

    assert.strictEqual(state.value, 0);
  });
});
