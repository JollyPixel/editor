// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PeerUVSelectionState } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PeerRegionSelections,
  type PeerRegionSelectionTarget
} from "#src/features/texture/PeerRegionSelections.ts";
import { PresenceStore } from "#src/state/PresenceStore.ts";

type TargetCall =
  | ["set", string, PeerUVSelectionState]
  | ["remove", string]
  | ["clearAll"];

function createTarget(): PeerRegionSelectionTarget & { calls: TargetCall[]; } {
  const calls: TargetCall[] = [];

  return {
    calls,
    set: (clientId, state) => void calls.push(["set", clientId, state]),
    remove: (clientId) => void calls.push(["remove", clientId]),
    clearAll: () => void calls.push(["clearAll"])
  };
}

function peerMarks(
  entries: Array<[uuid: string, clientId: string, color: string]>
): Map<string, { clientId: string; displayName: string; color: string; }[]> {
  const marks = new Map<string, { clientId: string; displayName: string; color: string; }[]>();
  for (const [uuid, clientId, color] of entries) {
    const peers = marks.get(uuid) ?? [];
    peers.push({ clientId, displayName: clientId, color });
    marks.set(uuid, peers);
  }

  return marks;
}

describe("PeerRegionSelections", () => {
  test("outlines the regions peers already selected", () => {
    const presence = new PresenceStore();
    presence.blockSelections = peerMarks([["torso", "bob", "#ff0000"]]);
    const target = createTarget();

    new PeerRegionSelections({ presence, target });

    assert.deepEqual(target.calls, [
      ["set", "bob", { regionId: "block-torso", color: "#ff0000" }]
    ]);
  });

  test("follows a peer to another block and drops them once they let go", () => {
    const presence = new PresenceStore();
    const target = createTarget();
    new PeerRegionSelections({ presence, target });

    presence.blockSelections = peerMarks([["torso", "bob", "#ff0000"]]);
    presence.blockSelections = peerMarks([["head", "bob", "#ff0000"]]);
    presence.blockSelections = new Map();

    assert.deepEqual(target.calls, [
      ["set", "bob", { regionId: "block-torso", color: "#ff0000" }],
      ["set", "bob", { regionId: "block-head", color: "#ff0000" }],
      ["remove", "bob"]
    ]);
  });

  test("clears every peer outline and stops listening on dispose", () => {
    const presence = new PresenceStore();
    const target = createTarget();
    const selections = new PeerRegionSelections({ presence, target });
    presence.blockSelections = peerMarks([["torso", "bob", "#ff0000"]]);
    target.calls.length = 0;

    selections.dispose();
    presence.blockSelections = peerMarks([["head", "bob", "#ff0000"]]);

    assert.deepEqual(target.calls, [["clearAll"]]);
  });
});
