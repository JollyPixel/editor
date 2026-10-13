// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  InvalidTagNameError,
  TagName
} from "#src/index.ts";

describe("TagName", () => {
  const accepted = [
    "v1",
    "1.0.0",
    "First_pass-2",
    "a".repeat(64)
  ];
  for (const name of accepted) {
    test(`accepts "${name.slice(0, 16)}"`, () => {
      assert.strictEqual(TagName.parse(name).unwrap().value, name);
    });
  }

  const refused = [
    "",
    "-v1",
    ".v1",
    "has space",
    "restore/3",
    "a".repeat(65)
  ];
  for (const name of refused) {
    test(`refuses "${name.slice(0, 16)}"`, () => {
      const parsed = TagName.parse(name);

      assert.ok(!parsed.ok);
      assert.ok(parsed.val instanceof InvalidTagNameError);
    });
  }

  test("a restore point is named after the event version it keeps", () => {
    const name = TagName.restorePoint(12).value;

    assert.strictEqual(name, "restore/12");
    assert.ok(TagName.isRestorePoint(name));
    assert.ok(!TagName.isRestorePoint("v1"));
  });
});
