// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PresenceStore } from "../../../src/app/state/index.ts";
import type { PeerMark } from "../../../src/collaboration/peerMarks.ts";

function mark(
  clientId: string
): PeerMark {
  return {
    clientId,
    displayName: clientId,
    color: "#ff0000"
  };
}

describe("PresenceStore", () => {
  it("copies the assigned roster and publishes every assignment", () => {
    const presence = new PresenceStore();
    let published = 0;
    presence.watch("peersChange", () => published++);

    const source: PresencePeer[] = [
      { clientId: "a", displayName: "Ada", color: "#fff" }
    ];
    presence.peers = source;
    source.push({ clientId: "b", displayName: "Bo", color: "#000" });
    presence.peers = [];

    assert.equal(published, 2);
    assert.equal(presence.peers.length, 0);
  });

  it("starts with empty selection maps", () => {
    const presence = new PresenceStore();

    assert.equal(presence.blockSelections.size, 0);
    assert.equal(presence.layerSelections.size, 0);
  });

  it("publishes every block selection assignment", () => {
    const presence = new PresenceStore();
    const seen: number[] = [];
    presence.watch("blockSelectionsChange", (marks) => seen.push(marks.size));

    presence.blockSelections = new Map([[4, [mark("bob")]]]);
    presence.blockSelections = new Map();

    assert.deepEqual(seen, [1, 0]);
    assert.equal(presence.blockSelections.size, 0);
  });

  it("publishes every layer selection assignment", () => {
    const presence = new PresenceStore();
    const seen: number[] = [];
    presence.watch("layerSelectionsChange", (marks) => seen.push(marks.size));

    presence.layerSelections = new Map([["voxel-layer:Ground", [mark("bob")]]]);
    presence.layerSelections = new Map();

    assert.deepEqual(seen, [1, 0]);
    assert.equal(presence.layerSelections.size, 0);
  });

  it("keeps the block and layer slices independent", () => {
    const presence = new PresenceStore();
    let layerPublished = 0;
    presence.watch("layerSelectionsChange", () => layerPublished++);

    presence.blockSelections = new Map([[1, [mark("bob")]]]);

    assert.equal(layerPublished, 0);
  });
});
