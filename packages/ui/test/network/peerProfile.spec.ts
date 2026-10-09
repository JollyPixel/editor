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
  presencePeerOf,
  readAvatar,
  readPeerId,
  readUsername,
  toPeerMetadata
} from "../../src/network/peerProfile.ts";

describe("peer profile", () => {
  test("publishes the username and peer id of an identity", () => {
    assert.deepEqual(toPeerMetadata({
      username: "Ada",
      peerId: "peer-1",
      color: "#000000",
      avatar: "/avatar.webp"
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

  test("reads a same-origin avatar path", () => {
    assert.equal(
      readAvatar({ avatar: "/api/accounts/a/avatar?v=1" }),
      "/api/accounts/a/avatar?v=1"
    );
  });

  test("ignores an avatar that is missing or points to another origin", () => {
    assert.equal(readAvatar(undefined), undefined);
    assert.equal(readAvatar({ avatar: null }), undefined);
    assert.equal(readAvatar({ avatar: "https://example.com/a.png" }), undefined);
    assert.equal(readAvatar({ avatar: "//example.com/a.png" }), undefined);
    assert.equal(readAvatar({ avatar: "/\\example.com/a.png" }), undefined);
    assert.equal(readAvatar({ avatar: "data:image/png;base64,AA" }), undefined);
  });

  test("describes a room peer by its profile", () => {
    const peer = {
      clientId: "client-1",
      role: "editor",
      profile: { username: "Ada", peerId: "peer-1", avatar: "/avatar.webp" },
      presence: {}
    };

    assert.deepEqual(presencePeerOf(peer), {
      clientId: "client-1",
      displayName: "Ada",
      color: colorFromKey("peer-1"),
      peerId: "peer-1",
      avatar: "/avatar.webp"
    });
  });
});
