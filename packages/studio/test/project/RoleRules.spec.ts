// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { RoleRules } from "../../src/project/RoleRules.ts";

// CONSTANTS
const kSpectator = RoleRules.from({
  "*.$join": "write",
  "*.$presence": "write",
  "*": "read"
});

function patterns(
  rules: RoleRules
): string[] {
  return [...rules].map((rule) => rule.pattern);
}

describe("RoleRules", () => {
  test("match names the first rule whose pattern covers the key", () => {
    assert.deepEqual(kSpectator.match("voxelmap.$join"), {
      index: 0,
      rule: {
        pattern: "*.$join",
        right: "write"
      }
    });
    assert.equal(kSpectator.match("voxelmap.place")?.index, 2);
    assert.equal(RoleRules.from({ "voxelmap.*": "write" }).match("pixelart.draw"), null);
  });

  test("move reorders a rule, which changes the rule that matches", () => {
    const moved = kSpectator.move(2, 0);

    assert.deepEqual(patterns(moved), ["*", "*.$join", "*.$presence"]);
    assert.equal(moved.match("voxelmap.$join")?.rule.right, "read");
    assert.deepEqual(moved.toJSON(), {
      "*": "read",
      "*.$join": "write",
      "*.$presence": "write"
    });
  });

  test("keeps one rule per pattern when adding or editing", () => {
    const added = kSpectator.add({
      pattern: "*",
      right: "void"
    });
    const edited = kSpectator.replace(0, {
      pattern: "*",
      right: "write"
    });

    assert.deepEqual(added.toJSON(), {
      "*": "void",
      "*.$join": "write",
      "*.$presence": "write"
    });
    assert.deepEqual(edited.toJSON(), {
      "*": "write",
      "*.$presence": "write"
    });
  });

  test("withGrant names a studio right exactly, ahead of every wildcard", () => {
    const granted = kSpectator.withGrant("studio.$settings", true);

    assert.equal(kSpectator.grants("studio.$settings"), false);
    assert.equal(granted.grants("studio.$settings"), true);
    assert.equal(granted.match("studio.$settings")?.index, 0);
    assert.deepEqual(
      patterns(granted.withGrant("studio.$settings", false)),
      patterns(kSpectator)
    );
  });
});
