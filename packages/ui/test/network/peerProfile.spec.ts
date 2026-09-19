// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  peerProfileColor,
  readPeerId,
  readUsername,
  toPeerMetadata
} from "../../src/network/peerProfile.ts";

describe("peer profile", () => {
  test("publishes the username and peer id of an identity", () => {
    assert.deepEqual(toPeerMetadata({
      username: "Ada",
      peerId: "peer-1",
      color: "#000000"
    }), {
      username: "Ada",
      peerId: "peer-1"
    });
  });

  test("falls back when the profile carries no identity", () => {
    assert.equal(readUsername(undefined), "Guest");
    assert.equal(readUsername({ username: 42 }), "Guest");
    assert.equal(readPeerId({}), undefined);
    assert.equal(peerProfileColor("client-1", {}), colorFromKey("client-1"));
  });

  test("prefers the published peer id over the client id for the color", () => {
    const profile = {
      username: "Ada",
      peerId: "peer-1"
    };

    assert.equal(readUsername(profile), "Ada");
    assert.equal(readPeerId(profile), "peer-1");
    assert.equal(peerProfileColor("client-1", profile), colorFromKey("peer-1"));
  });
});
