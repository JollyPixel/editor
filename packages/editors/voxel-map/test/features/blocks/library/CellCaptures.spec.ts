// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CellCaptures } from "../../../../src/features/blocks/library/CellCaptures.ts";

describe("CellCaptures", () => {
  it("rejects a capture that resolves after a newer one landed on its cell", () => {
    const captures = new CellCaptures();
    const older = captures.issue();
    const newer = captures.issue();

    assert.equal(captures.land(0, newer), true);
    assert.equal(captures.land(0, older), false);
  });

  it("lands captures of different cells independently", () => {
    const captures = new CellCaptures();
    const first = captures.issue();
    const second = captures.issue();

    assert.equal(captures.land(1, second), true);
    assert.equal(captures.land(0, first), true);
  });

  it("rejects a capture issued before its cell was erased", () => {
    const captures = new CellCaptures();
    const stale = captures.issue();
    captures.erase(0);

    assert.equal(captures.land(0, stale), false);
    assert.equal(captures.land(0, captures.issue()), true);
  });

  it("rejects every capture issued before a reset", () => {
    const captures = new CellCaptures();
    const first = captures.issue();
    const second = captures.issue();
    captures.reset();

    assert.equal(captures.land(0, first), false);
    assert.equal(captures.land(1, second), false);
    assert.equal(captures.land(0, captures.issue()), true);
  });
});
