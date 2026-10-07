// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AnimationCommandArbiter } from "#src/network/AnimationCommandArbiter.ts";
import { networkCommand } from "../helpers/clips.ts";

// CONSTANTS
const kAcceptAll = {
  accepts: () => true
};

describe("AnimationCommandArbiter", () => {
  test("refuses a clip removal based on a version older than a peer's edit of it, as an undo", () => {
    const arbiter = new AnimationCommandArbiter();
    arbiter.admit(kAcceptAll, networkCommand({
      action: "clip-changed",
      id: "walk",
      patch: { fps: 30 }
    }, { clientId: "A" }))!.commit(5);
    const removal = { action: "clip-removed", id: "walk" } as const;

    assert.equal(arbiter.admit(kAcceptAll, networkCommand(removal, { clientId: "B", basis: 3 })), null);
    assert.notEqual(arbiter.admit(kAcceptAll, networkCommand(removal, { clientId: "B", basis: 5 })), null);
    assert.notEqual(arbiter.admit(kAcceptAll, networkCommand(removal, { clientId: "B" })), null);
  });
});
