// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { Flag } from "../../src/flags/Flag.ts";

describe("Flag", () => {
  it("should name the flag in the error for a value it rejects", () => {
    const flag = Flag.positive(30, "actions per second", "hz");

    assert.equal(flag.parse("rate", "1.5"), 1.5);
    assert.throws(
      () => flag.parse("rate", "0"),
      /^BenchmarkError: --rate expects a positive number, got "0"$/
    );
  });

  it("should read toggles, optional text and repeated values", () => {
    assert.equal(Flag.toggle("gate rights").parse("rights", true), true);
    assert.equal(Flag.toggle("gate rights").parse("rights", false), false);
    assert.equal(Flag.text("dir", "profile").parse("profile", undefined), undefined);
    assert.equal(Flag.text("dir", "profile").parse("profile", "out"), "out");
    assert.deepEqual(
      Flag.list("substring", "skip files").parse("ignore", ["a", "b"]),
      ["a", "b"]
    );
  });

  it("should describe the flag, its value and its default in one usage line", () => {
    assert.equal(
      Flag.positive(30, "actions per second", "hz").usage("rate"),
      "  --rate <hz>              actions per second (default 30)"
    );
    assert.equal(
      Flag.choice(["edit", "join"], "edit", "scenario").usage("scenario"),
      "  --scenario <name>        scenario: edit, join (default edit)"
    );
    assert.equal(
      Flag.toggle("negotiate permessage-deflate").usage("compression"),
      "  --compression            negotiate permessage-deflate"
    );
  });
});
