// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  PresencePeer,
  PresenceStack
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  bindPresenceStack,
  type PresenceSource
} from "#src/presence/bindPresenceStack.ts";

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

class FakePresence extends Emitter<{
  peersChange: (peers: readonly PresencePeer[]) => void;
}> implements PresenceSource {
  peers: readonly PresencePeer[] = [kSelf];

  change(
    peers: readonly PresencePeer[]
  ): void {
    this.peers = peers;
    this.emit("peersChange", peers);
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
    const presence = new FakePresence();
    bindPresenceStack(element, presence, () => undefined);

    assert.deepEqual(element.peers, [kSelf]);
    assert.equal(element.hidden, true);

    presence.change([kSelf, kPeer]);
    assert.deepEqual(element.peers, [kSelf, kPeer]);
    assert.equal(element.hidden, false);
  });

  test("forwards a picked peer until unbound", () => {
    const element = createStack();
    const presence = new FakePresence();
    const selected: string[] = [];
    const unbind = bindPresenceStack(
      element,
      presence,
      (clientId) => selected.push(clientId)
    );

    selectPeer(element, "peer");
    unbind();
    selectPeer(element, "peer");
    presence.change([kSelf, kPeer]);

    assert.deepEqual(selected, ["peer"]);
    assert.equal(element.hidden, true);
  });
});
