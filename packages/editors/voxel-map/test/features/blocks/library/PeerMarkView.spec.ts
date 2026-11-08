// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  PeerMarks,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PeerMarkView } from "../../../../src/features/blocks/library/PeerMarkView.ts";

function createView(
  marks: PresencePeer[]
): PeerMarkView | null {
  return PeerMarkView.create(
    new PeerMarks(marks.map((peer) => [peer, 1] as const)),
    1
  );
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

function clientIds(
  peers: readonly PresencePeer[]
): string[] {
  return peers.map((entry) => entry.clientId);
}

describe("PeerMarkView.create", () => {
  it("returns null when a block carries no mark", () => {
    assert.equal(createView([]), null);
  });

  it("keeps a lone mark as the highlight without dots", () => {
    const view = createView([mark("ada")]);

    assert.equal(view?.highlight.clientId, "ada");
    assert.deepEqual(view?.dots, []);
  });

  it("dots every mark but the highlight owner", () => {
    const view = createView([
      mark("ada"),
      mark("bob"),
      mark("cleo")
    ]);

    assert.equal(view?.highlight.clientId, "ada");
    assert.deepEqual(clientIds(view?.dots ?? []), ["bob", "cleo"]);
  });

  it("caps the dots to three", () => {
    const view = createView([
      mark("ada"),
      mark("bob"),
      mark("cleo"),
      mark("dan"),
      mark("eve")
    ]);

    assert.deepEqual(clientIds(view?.dots ?? []), ["bob", "cleo", "dan"]);
  });
});

describe("PeerMarkView.names", () => {
  it("lists the highlight owner first", () => {
    assert.equal(new PeerMarkView([mark("ada"), mark("bob")]).names, "ADA, BOB");
  });
});
