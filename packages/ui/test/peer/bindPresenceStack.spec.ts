// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  bindPresenceStack,
  type PeerListSource
} from "../../src/peer/bindPresenceStack.ts";
import type { PresenceStack } from "../../src/peer/PresenceStack.ts";
import type { PresencePeer } from "../../src/peer/types.ts";

// CONSTANTS
const kSelf: PresencePeer = {
  clientId: "self",
  displayName: "Me",
  color: "red",
  self: true
};
const kPeer: PresencePeer = {
  clientId: "peer",
  displayName: "Peer",
  color: "blue"
};

class FakePeerList implements PeerListSource {
  peers: readonly PresencePeer[] = [kSelf];
  #listeners = new Set<(peers: readonly PresencePeer[]) => void>();

  subscribe(
    _event: "peersChange",
    listener: (peers: readonly PresencePeer[]) => void
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  change(
    peers: readonly PresencePeer[]
  ): void {
    this.peers = peers;
    for (const listener of this.#listeners) {
      listener(peers);
    }
  }
}

function createStack(): PresenceStack {
  return document.createElement("div") as unknown as PresenceStack;
}

function selectPeer(
  element: PresenceStack,
  clientId: string
): void {
  element.dispatchEvent(new CustomEvent("jolly-peer-select", {
    detail: { clientId }
  }));
}

describe("bindPresenceStack", () => {
  test("shows the stack only while another peer is present", () => {
    const element = createStack();
    const source = new FakePeerList();
    bindPresenceStack(element, source, () => undefined);

    assert.deepEqual(element.peers, [kSelf]);
    assert.equal(element.hidden, true);

    source.change([kSelf, kPeer]);
    assert.deepEqual(element.peers, [kSelf, kPeer]);
    assert.equal(element.hidden, false);
  });

  test("forwards a picked peer until unbound", () => {
    const element = createStack();
    const source = new FakePeerList();
    const selected: string[] = [];
    const unbind = bindPresenceStack(
      element,
      source,
      (clientId) => selected.push(clientId)
    );

    selectPeer(element, "peer");
    unbind();
    selectPeer(element, "peer");
    source.change([kSelf, kPeer]);

    assert.deepEqual(selected, ["peer"]);
    assert.equal(element.hidden, true);
  });
});
