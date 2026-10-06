// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  PeerMarks,
  PeerMarkView
} from "../../../../src/features/blocks/library/PeerMarks.ts";

function viewOf(
  marks: PresencePeer[] | undefined
): PeerMarkView | null {
  return new PeerMarks(new Map(marks === undefined ? [] : [[1, marks]])).viewOf(1);
}

function mark(
  clientId: string,
  color = "#ff0000"
): PresencePeer {
  return {
    clientId,
    displayName: clientId.toUpperCase(),
    color
  };
}

describe("PeerMarks.viewOf", () => {
  it("returns null when a block carries no mark", () => {
    assert.equal(viewOf(undefined), null);
    assert.equal(viewOf([]), null);
  });

  it("keeps a lone mark as the highlight without dots", () => {
    const view = viewOf([mark("ada")]);

    assert.equal(view?.highlight.clientId, "ada");
    assert.deepEqual(view?.dots, []);
  });

  it("dots every mark but the highlight owner", () => {
    const view = viewOf([
      mark("ada"),
      mark("bob"),
      mark("cleo")
    ]);

    assert.equal(view?.highlight.clientId, "ada");
    assert.deepEqual(
      view?.dots.map((dot) => dot.clientId),
      ["bob", "cleo"]
    );
  });

  it("caps the dots to three", () => {
    const view = viewOf([
      mark("ada"),
      mark("bob"),
      mark("cleo"),
      mark("dan"),
      mark("eve")
    ]);

    assert.deepEqual(
      view?.dots.map((dot) => dot.clientId),
      ["bob", "cleo", "dan"]
    );
  });
});

describe("PeerMarks.selfOf", () => {
  it("reads the local peer out of the roster", () => {
    const local = PeerMarks.selfOf([
      { clientId: "bob", displayName: "Bob", color: "#00ff00" },
      { clientId: "ada", displayName: "Ada", color: "#0000ff", self: true }
    ]);

    assert.deepEqual(local, {
      clientId: "ada",
      displayName: "Ada",
      color: "#0000ff",
      self: true
    });
  });

  it("falls back to an offline identity", () => {
    const local = PeerMarks.selfOf([]);

    assert.equal(local.clientId, "");
    assert.equal(local.self, true);
    assert.equal(typeof local.color, "string");
  });
});

describe("PeerMarks.withSelf", () => {
  const roster = [
    { clientId: "ada", displayName: "Ada", color: "#0000ff", self: true }
  ];

  it("gives the local selection priority over peers", () => {
    const merged = PeerMarks.withSelf(
      new Map([[3, [mark("bob"), mark("cleo")]]]),
      3,
      roster
    );

    assert.deepEqual(
      merged.marksOf(3).map((entry) => entry.clientId),
      ["ada", "bob", "cleo"]
    );
  });

  it("marks a block nobody else selected", () => {
    const merged = PeerMarks.withSelf(new Map(), 7, roster);

    assert.deepEqual(merged.marksOf(7), [PeerMarks.selfOf(roster)]);
  });

  it("keeps peer marks when there is no local selection", () => {
    const merged = PeerMarks.withSelf(new Map([[3, [mark("bob")]]]), null, roster);

    assert.deepEqual(
      merged.marksOf(3).map((entry) => entry.clientId),
      ["bob"]
    );
  });

  it("never mutates the peer map", () => {
    const peers = new Map([[3, [mark("bob")]]]);
    PeerMarks.withSelf(peers, 3, roster);

    assert.deepEqual(
      peers.get(3)?.map((entry) => entry.clientId),
      ["bob"]
    );
  });
});

describe("PeerMarkView.names", () => {
  it("lists the highlight owner first", () => {
    assert.equal(new PeerMarkView([mark("ada"), mark("bob")]).names, "ADA, BOB");
  });
});
