// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";

// Import Internal Dependencies
import { peerIdentity } from "../../src/peer/identity.ts";

describe("peerIdentity", () => {
  test("colors the identity from its peer id", () => {
    assert.deepEqual(peerIdentity("alice", "p-1"), {
      username: "alice",
      peerId: "p-1",
      color: colorFromKey("p-1")
    });
  });

  test("mints a fresh peer id when none is given", () => {
    const first = peerIdentity("alice");
    const second = peerIdentity("alice");

    assert.notEqual(first.peerId, second.peerId);
    assert.equal(first.color, colorFromKey(first.peerId));
  });
});
