// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  PeerMarks,
  type PeerMark
} from "../../src/peer/PeerMarks.ts";
import type { PresencePeer } from "../../src/peer/PresencePeer.ts";

function peer(
  clientId: string,
  displayName = clientId.toUpperCase()
): PresencePeer {
  return {
    clientId,
    displayName,
    color: `#${clientId}`
  };
}

function marks(
  entries: Array<[clientId: string, key: string]>
): PeerMarks<string> {
  return new PeerMarks(
    entries.map(([clientId, key]): PeerMark<string> => [peer(clientId), key])
  );
}

function clientIdsAt(
  peerMarks: PeerMarks<string>,
  key: string
): string[] {
  return peerMarks.peersAt(key).map((entry) => entry.clientId);
}

describe("PeerMarks", () => {
  it("groups peers by key in the given order", () => {
    const grouped = marks([["zoe", "walk"], ["ada", "walk"], ["bob", "run"]]);

    assert.deepEqual(clientIdsAt(grouped, "walk"), ["zoe", "ada"]);
    assert.deepEqual(clientIdsAt(grouped, "run"), ["bob"]);
    assert.deepEqual(clientIdsAt(grouped, "idle"), []);
    assert.equal(grouped.markedBy("bob"), "run");
    assert.equal(grouped.markedBy("eve"), undefined);
  });

  it("keeps one mark per peer, the first one given", () => {
    const grouped = marks([["ada", "walk"], ["ada", "run"]]);

    assert.equal(grouped.size, 1);
    assert.deepEqual(clientIdsAt(grouped, "walk"), ["ada"]);
  });

  it("puts a prepended peer first on its key", () => {
    const grouped = marks([["ada", "walk"]]).prepend(peer("me"), "walk");

    assert.deepEqual(clientIdsAt(grouped, "walk"), ["me", "ada"]);
  });

  it("moves a prepended peer that already marks another key", () => {
    const grouped = marks([["ada", "walk"]]).prepend(peer("ada"), "run");

    assert.equal(grouped.markedBy("ada"), "run");
    assert.deepEqual(clientIdsAt(grouped, "walk"), []);
  });
});

describe("PeerMarks.badges", () => {
  it("returns no badge for an unmarked key", () => {
    assert.deepEqual(new PeerMarks<string>().badges("layer"), []);
  });

  it("maps each peer to its color and name, three at most", () => {
    const grouped = marks([
      ["ada", "layer"],
      ["bob", "layer"],
      ["cid", "layer"],
      ["dan", "layer"]
    ]);

    assert.deepEqual(grouped.badges("layer"), [
      {
        color: "#ada",
        title: "ADA"
      },
      {
        color: "#bob",
        title: "BOB"
      },
      {
        color: "#cid",
        title: "CID"
      }
    ]);
  });
});

describe("PeerMarks.equals", () => {
  it("is true for the same marks built from fresh peer objects", () => {
    assert.ok(marks([["ada", "walk"]]).equals(marks([["ada", "walk"]])));
  });

  it("is false when a peer moved, left or was renamed", () => {
    const current = marks([["ada", "walk"], ["bob", "run"]]);

    assert.ok(!current.equals(marks([["ada", "run"], ["bob", "run"]])));
    assert.ok(!current.equals(marks([["ada", "walk"]])));
    assert.ok(!current.equals(new PeerMarks([
      [peer("ada", "Ada Lovelace"), "walk"],
      [peer("bob"), "run"]
    ])));
  });
});
