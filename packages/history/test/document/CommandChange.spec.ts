// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandChange } from "#src/index.ts";

// CONSTANTS
const kCommand = {
  key: "a",
  value: 1
};

describe("CommandChange", () => {
  test("each origin fixes its own inverse, peer and basis", () => {
    const changes = [
      CommandChange.local(kCommand, null, [{ key: "a", value: 0 }], 4),
      CommandChange.local(kCommand, null),
      CommandChange.remote(kCommand, null, "peer"),
      CommandChange.replay(kCommand, null)
    ];

    assert.deepEqual(
      changes.map(({ origin, inverse, clientId, basis }) => [origin, inverse, clientId, basis]),
      [
        ["local", [{ key: "a", value: 0 }], null, 4],
        ["local", [], null, undefined],
        ["remote", [], "peer", undefined],
        ["replay", [], null, undefined]
      ]
    );
  });
});
