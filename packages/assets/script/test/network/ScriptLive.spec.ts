// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { scriptAssetKind } from "#src/asset/scriptAssetKind.ts";
import type { ScriptNetworkCommand } from "#src/network/types.ts";

function insertion(
  clientId: string,
  at: number,
  insert: string
): ScriptNetworkCommand {
  return {
    action: "edited",
    changes: [{ at, insert }],
    clientId,
    seq: 1,
    timestamp: 0,
    basis: 0
  };
}

describe("script live arbitration", () => {
  test("refuses an edit based on the text from before a reload", () => {
    const handler = scriptAssetKind();
    const state = handler.create("a");
    state.replace("ab");
    let version = 0;
    const { commands } = handler;
    assert.ok(commands?.live);
    const live = commands.live({
      assetId: "a",
      kind: handler.kind,
      roomId: "script:a",
      state,
      version: () => version
    });

    live.arbitrate(insertion("A", 0, "x"))?.commit?.(++version);
    state.replace("replaced");
    live.reloaded?.();

    assert.equal(live.arbitrate(insertion("B", 1, "y")), null);
  });
});
