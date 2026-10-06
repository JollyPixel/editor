// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { freeName } from "#src/model/names.ts";

function takenIn(
  ...names: string[]
): (name: string) => boolean {
  const taken = new Set(names);

  return (name) => taken.has(name);
}

describe("freeName", () => {
  test("keeps a free name, trimmed", () => {
    assert.equal(freeName("  Walk ", takenIn()), "Walk");
  });

  test("numbers a taken name from 2, replacing a trailing number", () => {
    assert.equal(freeName("Walk", takenIn("Walk")), "Walk 2");
    assert.equal(freeName("Walk 2", takenIn("Walk 2", "Walk 3")), "Walk 4");
    assert.equal(freeName("Walk \t 12", takenIn("Walk \t 12")), "Walk 2");
  });

  test("keeps digits that are not a separate trailing number", () => {
    assert.equal(freeName("Walk2", takenIn("Walk2")), "Walk2 2");
    assert.equal(freeName("42", takenIn("42")), "42 2");
  });

  test("handles a long run of inner spaces with no trailing number", () => {
    const name = `a${" ".repeat(50_000)}b`;

    assert.equal(freeName(name, takenIn(name)), `${name} 2`);
  });
});
