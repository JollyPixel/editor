// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isModified,
  resolveHolder,
  splitPeerChips
} from "../../src/field/predicates.ts";
import { Mixed } from "../../src/field/mixed.ts";
import type { CollaboratorPresence } from "../../src/collab/types.ts";

function peer(
  clientId: string,
  editing?: string
): CollaboratorPresence {
  return {
    clientId,
    displayName: clientId,
    color: "oklch(60% 0.16 0)",
    ...(editing === undefined ? {} : { editing })
  };
}

describe("Field.isModified", () => {
  test("is false without a default, since there is nothing to revert to", () => {
    assert.equal(isModified(12, undefined), false);
  });

  test("is false when the value equals the default", () => {
    assert.equal(isModified(12, 12), false);
    assert.equal(isModified("a", "a"), false);
  });

  test("is true when the value differs", () => {
    assert.equal(isModified(13, 12), true);
    assert.equal(isModified("b", "a"), true);
  });

  test("is true for a Mixed value, since differing values cannot all equal one default", () => {
    assert.equal(isModified<number>(Mixed, 12), true);
  });

  test("is still false for a Mixed value with no default to revert to", () => {
    assert.equal(
      isModified<number>(Mixed, undefined),
      false
    );
  });

  test("compares objects by identity when given no comparator", () => {
    const fallback = { x: 1 };

    assert.equal(isModified({ x: 1 }, fallback), true);
    assert.equal(isModified(fallback, fallback), false);
  });

  /** What stops an object valued field lighting its revert gutter on an untouched value. */
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
    assert.equal(isModified(0, 0), false);
    assert.equal(isModified(0, 1), true);
    assert.equal(isModified("", "a"), true);
  });
});

describe("Field.resolveHolder", () => {
  test("prefers an explicit lockedBy over any peer", () => {
    const held = peer("ada");

    assert.equal(
      resolveHolder([peer("linus", "x")], held),
      held
    );
  });

  test("falls back to the first peer declaring itself editing", () => {
    const holder = resolveHolder(
      [
        peer("ada"),
        peer("linus", "position.x"),
        peer("grace", "position.y")
      ],
      null
    );

    assert.equal(holder?.clientId, "linus");
  });

  test("is null when peers are present but none is editing", () => {
    assert.equal(
      resolveHolder([peer("ada"), peer("linus")], null),
      null
    );
  });

  test("is null with no peers at all", () => {
    assert.equal(resolveHolder([], null), null);
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

  test("copies rather than aliasing the input", () => {
    const peers = [peer("a")];
    const { shown } = splitPeerChips(peers, 3);

    assert.notEqual(shown, peers);
  });
});
