// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { RoomClaim } from "#src/index.ts";
import { RoomHarness } from "../helpers/client/RoomHarness.ts";

// CONSTANTS
const kKey = "drive";

function setup(
  t: TestContext,
  peers: Record<string, Record<string, unknown>> = {}
) {
  t.mock.timers.enable({
    apis: ["Date"],
    now: 2_000
  });
  const harness = new RoomHarness();
  harness.room.join();
  harness.admit("self", peers);
  const claim = new RoomClaim(harness.room, {
    key: kKey
  });
  let changes = 0;
  claim.on("change", () => changes++);

  return {
    harness,
    claim,
    changes: () => changes
  };
}

function lastClaim(
  harness: RoomHarness
): unknown {
  return harness.patches.findLast((patch) => kKey in patch)?.[kKey];
}

describe("RoomClaim", () => {
  test("holds the claim for the peer that claims first", (t) => {
    const { harness, claim, changes } = setup(t);

    claim.claim();

    assert.equal(claim.holderId, "self");
    assert.equal(claim.heldBySelf, true);
    assert.equal(lastClaim(harness), 2_000);
    assert.equal(changes(), 1);
  });

  for (const [outcome, since, peerId] of [
    ["an earlier claim", 1_000, "peer"],
    ["a claim made at the same time by a lower client id", 2_000, "a-peer"]
  ] as const) {
    test(`withdraws its own claim when ${outcome} arrives`, (t) => {
      const { harness, claim } = setup(t);
      harness.peerJoined(peerId);

      claim.claim();
      harness.peerPresence(peerId, {
        [kKey]: since
      });

      assert.equal(claim.holderId, peerId);
      assert.equal(claim.heldBySelf, false);
      assert.equal(lastClaim(harness), null);
    });
  }

  test("sees a claim held before it was created", (t) => {
    const { claim } = setup(t, {
      peer: {
        [kKey]: 1_000
      }
    });

    assert.equal(claim.holderId, "peer");
  });

  test("ignores a claim while another peer holds it", (t) => {
    const { harness, claim } = setup(t, {
      peer: {
        [kKey]: 1_000
      }
    });

    claim.claim();

    assert.equal(claim.holderId, "peer");
    assert.equal(lastClaim(harness), undefined);
  });

  test("frees the claim when its holder leaves", (t) => {
    const { harness, claim, changes } = setup(t, {
      peer: {
        [kKey]: 1_000
      }
    });

    harness.peerLeft("peer");

    assert.equal(claim.holderId, null);
    assert.equal(changes(), 1);
  });

  for (const [action, end] of [
    ["released", (claim: RoomClaim) => claim.release()],
    ["destroyed", (claim: RoomClaim) => claim.destroy()]
  ] as const) {
    test(`withdraws the claim from peers once ${action}`, (t) => {
      const { harness, claim } = setup(t);
      claim.claim();

      end(claim);

      assert.equal(lastClaim(harness), null);
    });
  }
});
