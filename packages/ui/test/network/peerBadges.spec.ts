// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { peerBadges } from "../../src/network/peerBadges.ts";
import type { PresencePeer } from "../../src/peer/Presence.ts";

function peer(
  clientId: string
): PresencePeer {
  return {
    clientId,
    displayName: clientId.toUpperCase(),
    color: `#${clientId}`
  };
}

describe("peerBadges", () => {
  it("returns no badge for an unmarked key", () => {
    assert.deepEqual(peerBadges("layer", new Map()), []);
  });

  it("maps each peer to its color and name", () => {
    const marks = new Map([["layer", [peer("ada"), peer("bob")]]]);

    assert.deepEqual(peerBadges("layer", marks), [
      {
        color: "#ada",
        title: "ADA"
      },
      {
        color: "#bob",
        title: "BOB"
      }
    ]);
  });

  it("caps the badges to three", () => {
    const marks = new Map([[7, ["a", "b", "c", "d"].map(peer)]]);

    assert.deepEqual(
      peerBadges(7, marks).map((badge) => badge.title),
      ["A", "B", "C"]
    );
  });
});
