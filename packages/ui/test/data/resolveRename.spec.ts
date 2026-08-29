// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveRename } from "../../src/data/resolveRename.ts";

describe("resolveRename", () => {
  test("commits a trimmed name", () => {
    assert.equal(resolveRename("Spawn", "  Door Zone  "), "Door Zone");
  });

  test("drops a blank field rather than erasing the label", () => {
    assert.equal(resolveRename("Spawn", ""), null);
    assert.equal(resolveRename("Spawn", "   "), null);
  });

  test("drops an unchanged name, so nothing is written back", () => {
    assert.equal(resolveRename("Spawn", "Spawn"), null);
    assert.equal(resolveRename("Spawn", "  Spawn  "), null);
  });

  test("treats a case change as a real edit", () => {
    assert.equal(resolveRename("Spawn", "spawn"), "spawn");
  });
});
