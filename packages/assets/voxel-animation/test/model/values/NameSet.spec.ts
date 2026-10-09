// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NameSet } from "#src/model/values/NameSet.ts";

describe("NameSet", () => {
  test("compares names trimmed and in any case", () => {
    const names = new NameSet(["Walk"]);

    assert.equal(names.has(" WALK "), true);
    assert.equal(names.free("walk"), "walk 2");
  });

  test("keeps a free name, trimmed", () => {
    assert.equal(new NameSet().free("  Walk "), "Walk");
  });

  test("numbers a taken name from 2, replacing a trailing number", () => {
    assert.equal(new NameSet(["Walk"]).free("Walk"), "Walk 2");
    assert.equal(new NameSet(["Walk 2", "Walk 3"]).free("Walk 2"), "Walk 4");
    assert.equal(new NameSet(["Walk \t 12"]).free("Walk \t 12"), "Walk 2");
  });

  test("keeps digits that are not a separate trailing number", () => {
    assert.equal(new NameSet(["Walk2"]).free("Walk2"), "Walk2 2");
    assert.equal(new NameSet(["42"]).free("42"), "42 2");
  });

  test("handles a long run of inner spaces with no trailing number", () => {
    const name = `a${" ".repeat(50_000)}b`;

    assert.equal(new NameSet([name]).free(name), `${name} 2`);
  });
});
