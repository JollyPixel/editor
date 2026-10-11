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
  toPeerProfileMetadata,
  toPresencePeer
} from "../../src/network/peerProfile.ts";

describe("peer profile", () => {
  test("publishes the username and peer id of an identity", () => {
    assert.deepEqual(toPeerProfileMetadata({
      username: "Ada",
      peerId: "peer-1",
      color: "#000000",
      avatar: "/avatar.webp"
    }), {
      username: "Ada",
      peerId: "peer-1"
    });
  });

  test("colors a peer from its published peer id, falling back to its client id", () => {
    assert.equal(peerProfileColor("client-1", { peerId: "peer-1" }), colorFromKey("peer-1"));
    assert.equal(peerProfileColor("client-1", {}), colorFromKey("client-1"));
  });

  test("describes a room peer by its profile", () => {
    const peer = {
      clientId: "client-1",
      profile: { username: "Ada", peerId: "peer-1", avatar: "/avatar.webp" }
    };

    assert.deepEqual(toPresencePeer(peer), {
      clientId: "client-1",
      displayName: "Ada",
      color: colorFromKey("peer-1"),
      peerId: "peer-1",
      avatar: "/avatar.webp"
    });
  });

  test("badges a peer that joined through a link", () => {
    const peer = toPresencePeer({
      clientId: "client-1",
      profile: { username: "Guest", via: "link" }
    });

    assert.equal(peer.badge, "via link");
    assert.equal(peer.peerId, undefined);
  });
});
