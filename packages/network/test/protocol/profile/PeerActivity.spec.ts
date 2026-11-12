// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PEER_ACTIVITY_KEY,
  PEER_ACTIVITY_LABEL_MAX_LENGTH,
  parsePeerActivity
} from "#src/protocol/profile/PeerActivity.ts";

describe("parsePeerActivity", () => {
  test("reads the activity a peer publishes in its presence", () => {
    const activity = {
      label: "Placing 12 trees",
      progress: 0.5
    };

    assert.deepEqual(
      parsePeerActivity({ [PEER_ACTIVITY_KEY]: activity }),
      activity
    );
  });

  test("reads no activity from a missing, cleared or malformed value", () => {
    const values: unknown[] = [
      undefined,
      null,
      { label: "" },
      { label: "x".repeat(PEER_ACTIVITY_LABEL_MAX_LENGTH + 1) },
      { label: "Placing", progress: 2 },
      { label: "Placing", extra: true }
    ];

    assert.equal(parsePeerActivity(undefined), null);
    for (const value of values) {
      assert.equal(
        parsePeerActivity({ [PEER_ACTIVITY_KEY]: value }),
        null,
        JSON.stringify(value)
      );
    }
  });
});
