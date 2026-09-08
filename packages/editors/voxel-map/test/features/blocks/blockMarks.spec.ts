// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  blockMarkNames,
  mergeSelfBlockMark,
  resolveBlockMarks,
  selfBlockMark,
  type BlockPeerMark
} from "../../../src/features/blocks/blockMarks.ts";

function mark(
  clientId: string,
  color = "#ff0000"
): BlockPeerMark {
  return {
    clientId,
    displayName: clientId.toUpperCase(),
    color
  };
}

describe("resolveBlockMarks", () => {
  it("returns null when a block carries no mark", () => {
    assert.equal(resolveBlockMarks(undefined), null);
    assert.equal(resolveBlockMarks([]), null);
  });

  it("keeps a lone mark as the highlight without dots", () => {
    const view = resolveBlockMarks([mark("ada")]);

    assert.equal(view?.highlight.clientId, "ada");
    assert.deepEqual(view?.dots, []);
  });

  it("dots every mark but the highlight owner", () => {
    const view = resolveBlockMarks([
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
    const view = resolveBlockMarks([
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

describe("selfBlockMark", () => {
  it("reads the local peer out of the roster", () => {
    const local = selfBlockMark([
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
    const local = selfBlockMark([]);

    assert.equal(local.clientId, "");
    assert.equal(local.self, true);
    assert.equal(typeof local.color, "string");
  });
});

describe("mergeSelfBlockMark", () => {
  const local = selfBlockMark([
    { clientId: "ada", displayName: "Ada", color: "#0000ff", self: true }
  ]);

  it("gives the local selection priority over peers", () => {
    const merged = mergeSelfBlockMark(
      new Map([[3, [mark("bob"), mark("cleo")]]]),
      3,
      local
    );

    assert.deepEqual(
      merged.get(3)?.map((entry) => entry.clientId),
      ["ada", "bob", "cleo"]
    );
  });

  it("marks a block nobody else selected", () => {
    const merged = mergeSelfBlockMark(new Map(), 7, local);

    assert.deepEqual(merged.get(7), [local]);
  });

  it("keeps peer marks when there is no local selection", () => {
    const peers = new Map([[3, [mark("bob")]]]);
    const merged = mergeSelfBlockMark(peers, null, local);

    assert.deepEqual(
      merged.get(3)?.map((entry) => entry.clientId),
      ["bob"]
    );
  });

  it("never mutates the peer map", () => {
    const peers = new Map([[3, [mark("bob")]]]);
    mergeSelfBlockMark(peers, 3, local);

    assert.deepEqual(
      peers.get(3)?.map((entry) => entry.clientId),
      ["bob"]
    );
  });
});

describe("blockMarkNames", () => {
  it("lists the highlight owner first", () => {
    const names = blockMarkNames({
      highlight: mark("ada"),
      dots: [mark("bob")]
    });

    assert.equal(names, "ADA, BOB");
  });
});
