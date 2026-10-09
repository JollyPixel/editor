// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import type { PresencePeer } from "../../src/peer/Presence.ts";
import { PeerRoster } from "../../src/network/PeerRoster.ts";
import { peerProfileColor } from "../../src/network/peerProfile.ts";
import {
  createRoomHarness,
  type RoomHarness
} from "../helpers/network/roomHarness.ts";

interface ProfileHarness extends RoomHarness {
  peers: () => readonly PresencePeer[];
}

function createHarness(): ProfileHarness {
  const harness = createRoomHarness();
  let peers: readonly PresencePeer[] = [];
  new PeerRoster({
    room: harness.room,
    identity: {
      username: "Ada",
      peerId: "local-peer",
      color: peerProfileColor("ignored", { peerId: "local-peer" }),
      avatar: "/api/accounts/local-peer/avatar?v=1"
    },
    publish: (next) => {
      peers = next;
    }
  });

  return {
    ...harness,
    peers: () => peers
  };
}

describe("PeerRoster profiles", () => {
  test("follows the local username and avatar of the profile the room admitted", () => {
    const harness = createHarness();

    harness.admitProfile({
      username: "Ada Lovelace",
      peerId: "local-peer",
      avatar: "/api/accounts/local-peer/avatar?v=2"
    });
    harness.emit("peer-profile", {
      clientId: "local",
      patch: {
        username: "Ada Lovelace",
        avatar: "/api/accounts/local-peer/avatar?v=2"
      }
    });

    const [local] = harness.peers();
    assert.strictEqual(local.displayName, "Ada Lovelace");
    assert.strictEqual(local.avatar, "/api/accounts/local-peer/avatar?v=2");
  });

  test("republishes a remote peer whose profile changed", () => {
    const harness = createHarness();
    harness.addPeer("client-a", {
      profile: {
        username: "Alan",
        peerId: "a",
        avatar: null
      }
    });
    harness.emit("peer-joined", { clientId: "client-a" });

    harness.addPeer("client-a", {
      profile: {
        username: "Alan",
        peerId: "a",
        avatar: "/api/accounts/a/avatar?v=3"
      }
    });
    harness.emit("peer-profile", {
      clientId: "client-a",
      patch: { avatar: "/api/accounts/a/avatar?v=3" }
    });

    assert.strictEqual(harness.peers()[1].avatar, "/api/accounts/a/avatar?v=3");
  });
});
