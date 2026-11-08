// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  PeerMarks,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { withSelf } from "../../../../src/features/blocks/library/withSelf.ts";

// CONSTANTS
const kRoster: PresencePeer[] = [
  {
    clientId: "bob",
    displayName: "Bob",
    color: "#00ff00"
  },
  {
    clientId: "ada",
    displayName: "Ada",
    color: "#0000ff",
    self: true,
    peerId: "account-ada",
    avatar: "/ada.webp"
  }
];

function mark(
  clientId: string
): PresencePeer {
  return {
    clientId,
    displayName: clientId.toUpperCase(),
    color: "#ff0000"
  };
}

function clientIds(
  peers: readonly PresencePeer[]
): string[] {
  return peers.map((entry) => entry.clientId);
}

describe("withSelf", () => {
  it("gives the local selection priority over peers", () => {
    const merged = withSelf(
      new PeerMarks([[mark("bob"), 3], [mark("cleo"), 3]]),
      3,
      kRoster
    );

    assert.deepEqual(clientIds(merged.peersAt(3)), ["ada", "bob", "cleo"]);
  });

  it("marks a block with the local peer's name and color from the roster", () => {
    const merged = withSelf(new PeerMarks<number>(), 7, kRoster);

    assert.deepEqual(merged.peersAt(7), [
      {
        clientId: "ada",
        displayName: "Ada",
        color: "#0000ff",
        self: true
      }
    ]);
  });

  it("falls back to an offline identity when the roster has no local peer", () => {
    const [local] = withSelf(new PeerMarks<number>(), 7, []).peersAt(7);

    assert.equal(local.clientId, "");
    assert.equal(local.self, true);
    assert.equal(typeof local.color, "string");
  });

  it("keeps peer marks when there is no local selection", () => {
    const merged = withSelf(new PeerMarks([[mark("bob"), 3]]), null, kRoster);

    assert.deepEqual(clientIds(merged.peersAt(3)), ["bob"]);
  });
});
