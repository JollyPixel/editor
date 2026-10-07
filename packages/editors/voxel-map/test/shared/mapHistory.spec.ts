// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { skippedMessage } from "../../src/shared/mapHistory.ts";

describe("skippedMessage", () => {
  test("names the skipped step and why it was refused", () => {
    assert.equal(
      skippedMessage({ label: "Paint", refused: { reason: "peer", clientId: "alice" } }),
      "Skipped \"Paint\": a peer changed it since"
    );
    assert.equal(
      skippedMessage({ label: null, refused: { reason: "changed" } }),
      "Skipped a step: its voxels moved or changed since"
    );
  });
});
