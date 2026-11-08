// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isModified,
  lockHolder,
  splitPeerChips
} from "../../src/field/predicates.ts";
import { Mixed } from "../../src/field/mixed.ts";
import type { PresencePeer } from "../../src/peer/PresencePeer.ts";

function peer(
  clientId: string,
  self = false
): PresencePeer {
  return {
    clientId,
    displayName: clientId,
    color: "oklch(60% 0.16 0)",
    self
  };
}

describe("Field.isModified", () => {
  test("is false without a default, since there is nothing to revert to", () => {
    assert.equal(isModified(12, undefined, Object.is), false);
  });

  test("is false when the value equals the default", () => {
    assert.equal(isModified(12, 12, Object.is), false);
    assert.equal(isModified("a", "a", Object.is), false);
  });

  test("is true when the value differs", () => {
    assert.equal(isModified(13, 12, Object.is), true);
    assert.equal(isModified("b", "a", Object.is), true);
  });

  test("is true for a Mixed value, since differing values cannot all equal one default", () => {
    assert.equal(isModified<number>(Mixed, 12, Object.is), true);
  });

  test("is still false for a Mixed value with no default to revert to", () => {
    assert.equal(
      isModified<number>(Mixed, undefined, Object.is),
      false
    );
  });

  test("compares objects by identity with Object.is", () => {
    const fallback = { x: 1 };

    assert.equal(isModified({ x: 1 }, fallback, Object.is), true);
    assert.equal(isModified(fallback, fallback, Object.is), false);
  });

  test("uses a supplied comparator for object values", () => {
    function equals(
      a: { x: number; },
      b: { x: number; }
    ): boolean {
      return a.x === b.x;
    }

    assert.equal(
      isModified({ x: 1 }, { x: 1 }, equals),
      false
    );
    assert.equal(
      isModified({ x: 2 }, { x: 1 }, equals),
      true
    );
  });

  test("does not treat 0 or an empty string as absent", () => {
    assert.equal(isModified(0, 0, Object.is), false);
    assert.equal(isModified(0, 1, Object.is), true);
    assert.equal(isModified("", "a", Object.is), true);
  });
});

describe("Field.lockHolder", () => {
  test("a remote editor holds the field", () => {
    assert.equal(lockHolder([peer("ada"), peer("linus")])?.clientId, "ada");
  });

  test("the local peer never locks its own field, even when contended", () => {
    assert.equal(lockHolder([peer("me", true), peer("ada")]), null);
  });

  test("is null with no editors", () => {
    assert.equal(lockHolder([]), null);
  });
});

describe("Field.splitPeerChips", () => {
  test("shows every peer when under the limit", () => {
    const peers = [
      peer("a"),
      peer("b")
    ];
    const { shown, overflow } = splitPeerChips(peers, 3);

    assert.equal(shown.length, 2);
    assert.equal(overflow, 0);
  });

  test("shows every peer when exactly at the limit", () => {
    const { shown, overflow } = splitPeerChips(
      [peer("a"), peer("b"), peer("c")],
      3
    );

    assert.equal(shown.length, 3);
    assert.equal(overflow, 0);
  });

  test("counts the remainder past the limit", () => {
    const peers = [
      peer("a"),
      peer("b"),
      peer("c"),
      peer("d"),
      peer("e")
    ];
    const { shown, overflow } = splitPeerChips(peers, 3);

    assert.deepEqual(
      shown.map((entry) => entry.clientId),
      ["a", "b", "c"]
    );
    assert.equal(overflow, 2);
  });

  test("gives the local peer no chip and no overflow count", () => {
    const { shown, overflow } = splitPeerChips(
      [peer("self", true), peer("a"), peer("b"), peer("c")],
      3
    );

    assert.deepEqual(
      shown.map((entry) => entry.clientId),
      ["a", "b", "c"]
    );
    assert.equal(overflow, 0);
    assert.deepEqual(splitPeerChips([peer("self", true)], 3).shown, []);
  });

  test("copies rather than aliasing the input", () => {
    const peers = [peer("a")];
    const { shown } = splitPeerChips(peers, 3);

    assert.notEqual(shown, peers);
  });
});
