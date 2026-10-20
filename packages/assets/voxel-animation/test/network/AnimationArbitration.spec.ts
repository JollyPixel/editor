// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { voxelAnimationAssetKind } from "#src/index.ts";
import {
  clip,
  networkCommand
} from "../helpers/clips.ts";

function liveArbiter() {
  const handler = voxelAnimationAssetKind();
  const state = handler.create("asset");
  state.apply(networkCommand({ action: "clip-added", clip: clip("walk") }));

  return handler.commands!.live!({
    assetId: "asset",
    kind: handler.kind,
    roomId: "room",
    state
  });
}

describe("voxel-animation arbitration", () => {
  test("refuses a clip removal based on a version older than a peer's edit of it, as an undo", () => {
    const live = liveArbiter();
    live.arbitrate(networkCommand({
      action: "clip-changed",
      id: "walk",
      patch: { fps: 30 }
    }, { clientId: "A" }))!.commit!(5);
    const removal = { action: "clip-removed", id: "walk" } as const;

    assert.equal(live.arbitrate(networkCommand(removal, { clientId: "B", basis: 3 })), null);
    assert.notEqual(live.arbitrate(networkCommand(removal, { clientId: "B", basis: 5 })), null);
    assert.notEqual(live.arbitrate(networkCommand(removal, { clientId: "B" })), null);
  });
});
