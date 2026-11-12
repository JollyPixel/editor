// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ColorSequence } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  markedPeers,
  peerProfileColor,
  toPeerProfileMetadata,
  toPresencePeer
} from "../../src/network/peerProfile.ts";
import { createRoomHarness } from "../helpers/network/roomHarness.ts";

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

  test("marks an observer identity in its profile", () => {
    const profile = toPeerProfileMetadata({
      username: "Ada",
      peerId: "peer-1",
      color: "#000000"
    }, { observer: true });

    assert.equal(profile.observer, true);
  });

  test("colors a peer from its published peer id, falling back to its client id", () => {
    assert.equal(peerProfileColor("client-1", { peerId: "peer-1" }), ColorSequence.default.pick("peer-1"));
    assert.equal(peerProfileColor("client-1", {}), ColorSequence.default.pick("client-1"));
  });

  test("describes a room peer by its profile", () => {
    const peer = {
      clientId: "client-1",
      profile: { username: "Ada", peerId: "peer-1", avatar: "/avatar.webp" }
    };

    assert.deepEqual(toPresencePeer(peer), {
      clientId: "client-1",
      displayName: "Ada",
      color: ColorSequence.default.pick("peer-1"),
      peerId: "peer-1",
      avatar: "/avatar.webp"
    });
  });

  test("describes what a peer says it is doing, with its progress", () => {
    function describeActivity(
      activity: unknown
    ): string | undefined {
      return toPresencePeer({
        clientId: "client-1",
        profile: { username: "Builder" },
        presence: { activity }
      }).activity;
    }

    assert.equal(describeActivity({ label: "Placing trees" }), "Placing trees");
    assert.equal(
      describeActivity({ label: "Placing trees", progress: 0.404 }),
      "Placing trees · 40%"
    );
    assert.equal(describeActivity(null), undefined);
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

describe("markedPeers", () => {
  test("pairs present peers with their values by client id, skipping null values and absent senders", () => {
    const harness = createRoomHarness();
    harness.addPeer("zoe", { profile: { username: "Zoe", peerId: "zoe" } });
    harness.addPeer("ada", { profile: { username: "Ada", peerId: "ada" } });
    harness.addPeer("bob");
    const values = new Map<string, { clip: string; } | null>([
      ["zoe", { clip: "walk" }],
      ["gone", { clip: "walk" }],
      ["bob", null],
      ["ada", { clip: "run" }]
    ]);

    const marked = markedPeers(harness.room, values);

    assert.deepEqual(
      marked.map(([peer, value]) => [peer.displayName, value.clip]),
      [["Ada", "run"], ["Zoe", "walk"]]
    );
  });
});
